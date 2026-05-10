# EmThaoJPSearch — Project briefing for Claude

Internal Japanese marketplace search aggregator. Single keyword → results from
Mercari + Yahoo Auctions + PayPay Flea Market, normalized into a unified shape,
displayed with both JPY and VND prices.

## Stack and layout

- Monorepo, two siblings: `backend/` (Node 20 + Express + Playwright) and
  `frontend/` (Vite + React).
- Backend deploys to **Render free Web Service** (Docker runtime). Frontend to **Vercel free**.
- CommonJS in backend (`require/module.exports`). Don't switch to ESM without a reason.
- Frontend is ESM (Vite default). React 19. Plain CSS (no Tailwind/CSS-in-JS).
- Package manager: **npm** in both. Node 20+ required (`node --watch` used for dev).
- Repo: https://github.com/neotruong/emthao-jp-search (public).

## Status

**Phase 1 — Done ✅ (deployed 2026-05-10).** Both backend and frontend are
built, smoke-tested, committed, and deploying. See `Plan.md` for the file
map, FR coverage table, and production runbook (URLs are filled in there).

Phases 2–5 (Redis cache, server-side filters, image search, auth + cloud
sync, residential proxy) live in
`~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`.

## Key context for future sessions

### User is in Vietnam
The user's IP geolocates to Vietnam. This affects scraping behavior:
- **Mercari** sets `country_code=VN` cookie from the request IP and returns
  prices in VND in the rendered HTML. The cookie is server-set from
  CF-IPCountry, so client-side overrides don't work. We bypass this by
  intercepting the JSON API response — see `backend/src/scrapers/mercari.skill.md`.
- **PayPay Flea Market** geo-blocks search from non-JP IPs. From a VN IP (and
  likely from Render Singapore too), the page renders `「データの取得に失敗しました」`
  and falls back to generic recommendations. Our scraper detects this state
  and returns `[]` — see `backend/src/scrapers/paypay.skill.md`. Real fix
  requires a JP residential proxy (Phase 5).
- **Yahoo Auctions** is fine from VN IPs.

### Pricing model
Every `/search` response includes a `pricing` block:

```json
"pricing": { "rate": 185, "markupPct": 20, "shipVndPerKg": 175000, "defaultWeightKg": 0.2 }
```

The frontend recomputes VND client-side using the formula
`VND = JPY × rate × (1 + markupPct/100) + weightKg × shipVndPerKg`.
Weight is user-input (default 0.2 kg, persisted in localStorage). Changing the
weight or markup must NOT trigger a re-fetch — only re-render.

The 175,000 VND/kg shipping is the cost from JP to Vietnam by air cargo.

### Approved Phase 1 decisions (don't second-guess these without asking)
- Three Yahoo modes mirroring Yahoo's UI: `すべて` (all), `オークション` (auction →
  `fixed=2`), `定額` (fixed → `fixed=1`). The mode field on the result is taken
  from the request param when filtered, since the Yahoo URL is authoritative.
- Seller stars/reviews dropped from MVP. Replaced by a "View Translated"
  link on every card that opens the listing through Google Translate's host
  proxy: `<host-with-dashes>.translate.goog/...?_x_tr_sl=ja&_x_tr_tl=en&_x_tr_hl=en`.
- Cache is in-memory `lru-cache` for Phase 1. Phase 2 swaps to Upstash Redis
  behind the same `cache.js` interface.
- Scraper hard timeout is **12 s**. Scraper failure returns `[]`, never throws —
  so partial results are always returned. The route uses `Promise.all` with
  `withTimeout` wrappers, never `Promise.race` (we want partial results, not
  first-to-finish).
- **FR-20 Local Bookmarks (added 2026-05-10):** localStorage-only, key
  `emthao.bookmarks`, FIFO 200-item cap, keyed by `item.url`. Heart toggle on
  every result + dedicated Bookmarks view. Phase 4 will upgrade to cloud sync,
  not replace. Spec: `Requirements/local-bookmarks.md`.
- **Frontend UI is English-only (decided 2026-05-10):** every label, button,
  placeholder, and meta-chip in `frontend/` MUST be English. Backend keeps
  source-of-truth values (e.g. Mercari condition `新品、未使用`, Yahoo
  `残り 1日`) and the frontend translates at render time via
  `frontend/src/lib/labels.js`. Listing **titles** stay in Japanese — those
  are the actual marketplace listings; the user can click "Translated" on
  any card to view the listing through Google Translate. When adding new
  UI strings: write English directly. When surfacing a new backend field
  that may contain JP text, extend `labels.js` with a translation map.
- **Mercari item filtering (FR-22 follow-up, 2026-05-10):** the scraper
  drops items where `status !== 'ITEM_STATUS_ON_SALE'`, `itemType !==
  'ITEM_TYPE_MERCARI'`, or `shop != null`. Beyond/Shops listings (IDs like
  `P9oQg44DuFfEzoSHLUGtfE`) don't reliably resolve under `/item/<id>` and
  show the 「エラーが発生しました」 page on click. Don't relax these filters
  without first verifying URL routing works for Beyond items.
- **Search history is local-only (FR-21):** localStorage `emthao.history`,
  20-item cap, MRU-deduped on re-search. Phase 4 cloud history will sync
  this on first login.
- **Pagination is per-source via different mechanisms (FR-22):** Mercari
  slices its single API response (no extra round-trip until page 7);
  Yahoo navigates to `&b=<offset>&n=<limit>`; PayPay is a no-op while
  geo-blocked. Cache key includes `page`. The frontend's "Load more"
  button appends, never replaces.
- **Filters are client-side in Phase 1 (FR-23):** price min/max +
  condition multi-select live in `frontend/src/lib/filters.js`. Backend
  `?price_min/max/condition` params are Phase 2 work — until then, the
  user can over-fetch via Load More and narrow client-side. Don't push
  filters to the backend without also updating cache key + scraper opts.
  - **Currency toggle on price filter (added 2026-05-10):** the price
    bounds accept either JPY or VND. VND bounds are converted to JPY via
    the inverse formula `JPY = (VND − weight × shipPerKg) / (rate × (1 + markup%))`
    (`vndToJpy` in `lib/filters.js`). JPY bounds and VND bounds are stored
    independently — toggling does not clear the inactive set, so the user
    can stack both (intersection). Reset Filters clears all four.
- **"Newest update" sort (added 2026-05-10):** uses `item.updatedAt` (ISO
  string, populated only by Mercari from the API's `updated` UNIX seconds).
  Yahoo and PayPay don't expose post-time and naturally sort to the bottom.
  When adding a new source with post-time, normalize to `updatedAt` and
  the existing sort works without changes.
- **WeightInput supports locale decimals (added 2026-05-10):** the input
  accepts both `.` and `,` as decimal separators (Vietnamese locale uses
  `,`). Min is **0.1 kg** (was 0). Implementation uses `<input type="text"
  inputMode="decimal">` with manual parsing — `<input type="number">`
  caused locale-dependent keystroke loss mid-edit. Don't change back.
- **Cache bypass is a query param (FR-24):** `?nocache=1` on `/search`
  skips the cache *read* but still writes. The frontend "Refresh"
  button next to the search submit issues this. Used when sellers post
  new items mid-session and the user wants a fresh scrape.

## Lessons learned during Phase 1

0. **Don't show items the marketplace itself won't render.** Mercari's API
   gleefully returns sold-out and Beyond/Shops items mixed into search
   results; clicking those drops the user on 「エラーが発生しました」. Filter
   by `status === 'ITEM_STATUS_ON_SALE'` and only emit URLs for known
   working listing types. Goes for Yahoo too: ended auctions still load
   but show a banner; we don't currently filter, but if the user reports
   stale Yahoo links, that's the next thing to add.
1. **Don't trust DOM prices on geo-aware sites.** Mercari's DOM shows
   localized currency from CF-IPCountry. Always prefer their JSON API. We
   wasted time first trying to override the `country_code` cookie — server
   ignores it.
2. **`node --watch` only watches the transitive deps of files already
   `require`-d.** When a route's lazy-loaded module changes, the watcher
   doesn't restart. Force-restart by killing the process when editing
   scrapers/routes that haven't been hit yet.
3. **Use `pkill -f "node --watch" && lsof -ti:8787 | xargs kill -9` to
   unstick port 8787.** SIGTERM alone may leave a child process holding it.
4. **`p-limit` v4+ is ESM-only.** Stick to v3.x (`p-limit@^3.1.0`) for
   CommonJS backend.
5. **PayPay's `/api/v1/recommend/items` is NOT a search endpoint** despite
   the URL containing `recommendType=fleamarket_web_search`. It returns
   generic recommendations regardless of the query. Don't be fooled.
6. **`__NEXT_DATA__` is gone from Mercari** — they shipped a CSR rewrite. No
   server-rendered state to scrape. API interception is the only path.

## Files Claude should know about

- `Plan.md` — session-resumption doc
- `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md` — full multi-phase plan
- `backend/src/scrapers/mercari.skill.md` — Mercari mechanism + maintenance
- `backend/src/scrapers/yahoo.skill.md` — Yahoo mechanism + maintenance
- `backend/src/scrapers/paypay.skill.md` — PayPay mechanism + maintenance
- `backend/scripts/debug-{mercari,paypay}.js` — when scraper output looks wrong, run these to dump raw API/DOM
- `Requirements/` — original spec (mostly captured by the plan above)

## Things to NOT do

- Don't suggest moving to Edge runtime / Vercel functions for the backend —
  Playwright/Chromium can't run there.
- Don't add seller-rating/star scraping. The user explicitly dropped this from
  MVP in favor of the Google Translate link.
- Don't touch the per-domain pacing in `concurrency.js` — `≥1 s` between same-host
  hits is a deliberate anti-block measure.
- Don't bypass the geo-block detector in `paypay.js` — without it the scraper
  returns 96 unrelated recommendations as if they were search results.
