# EmThaoJPSearch — Session Resumption Plan

> Use this file to pick up the build in a future Claude session. The full
> architecture / phase plan lives at
> `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`.

## Where we are right now

**Phase 1 fully built and verified locally.** Backend on `:8787`, frontend on `:5173`. End-to-end E2E smoke test passes (search, bookmark, switch view, weight live update, translate URL, reload persistence) with no JS errors.

Next step: deploy (Vercel for `frontend/`, Render for `backend/`).

- Local server: `backend/` on `:8787`
- 2 of 3 sources return real JPY data; 1 needs a JP proxy (Phase 5)
- Plan agreed via `/plan` mode → approved → executed in option-2 checkpoint mode (backend first, then frontend)

## What's done — backend ✅

| File | Purpose |
|---|---|
| `backend/package.json` | Node 20, deps: express, playwright, lru-cache, p-limit (v3 CJS), pino, pino-pretty, cors, dotenv |
| `backend/Dockerfile` | `mcr.microsoft.com/playwright:v1.49.0-jammy` base, `node src/server.js` |
| `backend/render.yaml` | Free Web Service in Singapore region, `/health` healthcheck |
| `backend/.env.example` | `PORT=8787`, `ALLOWED_ORIGIN=http://localhost:5173`, `LOG_LEVEL=info` |
| `backend/src/server.js` | Express app, CORS, warms Chromium before `app.listen` |
| `backend/src/browser.js` | Singleton Chromium, restart-on-disconnect, `newContext()` with ja-JP / Asia-Tokyo / random UA |
| `backend/src/cache.js` | `lru-cache` 7-min TTL, `cacheKey({q, sources, yahooMode, limit})` |
| `backend/src/concurrency.js` | `paceDomain()` ≥1 s between hits to same host |
| `backend/src/logger.js` | pino, pretty in dev, JSON in prod |
| `backend/src/config/pricing.js` | `JPY_VND_RATE=185`, `MARKUP_PCT=20`, `SHIP_VND_PER_KG=175000`, `DEFAULT_WEIGHT_KG=0.2` |
| `backend/src/config/selectors.js` | Versioned selector map per scraper, `verifiedAt: '2026-05-10'` |
| `backend/src/config/userAgents.js` | 8-string UA pool + `pickUA()` |
| `backend/src/util/parsePrice.js` | `"¥12,345" → 12345` |
| `backend/src/util/absoluteUrl.js` | resolve relative URLs |
| `backend/src/scrapers/normalize.js` | `toItem()` → unified Item shape |
| `backend/src/scrapers/mercari.js` | **API interception** of `/v2/entities:search`, see `mercari.skill.md` |
| `backend/src/scrapers/yahoo.js` | DOM scrape `.Product` BEM, mode from URL filter, see `yahoo.skill.md` |
| `backend/src/scrapers/paypay.js` | DOM scrape with geo-block detection, see `paypay.skill.md` |
| `backend/src/routes/search.js` | `GET /search?q=&sources=&yahooMode=&limit=` with cache + parallel scrapers + 12 s per-source timeout |
| `backend/src/routes/health.js` | `GET /health` returning browser status + cache size |
| `backend/scripts/debug-mercari.js` | Reusable script to inspect Mercari API/DOM |
| `backend/scripts/debug-paypay.js` | Reusable script to inspect PayPay API/DOM |
| `README.md` | Setup + deploy + scraper notes + known limitations |

### Verified locally
- `curl /health` → `{"status":"ok","browserConnected":true,"cacheEntries":N}`
- `curl /search?q=iphone&limit=5` → mercari ✅ (real JPY + condition labels), yahoo ✅, paypay returns `[]` (geo-blocked, expected from VN IP)
- `yahooMode=auction|fixed|all` produces correct `mode` field on each result
- Cache: identical query within 7 min returns `cached:true` in <100 ms
- Pricing config returned in every response so the frontend can recompute VND client-side without re-fetching

## Scope amendment 2026-05-10 — local bookmarks (FR-20)

Local-only bookmarks moved from Phase 4 into Phase 1. localStorage-backed,
no backend, no auth. Phase 4's user-account bookmarks will upgrade this to
cloud-sync. See `Requirements/local-bookmarks.md` for the full spec.

## Scope amendment 2026-05-10b — search extras (FR-21–FR-24)

Four follow-on items added to Phase 1 after the initial frontend was working:

- **FR-21 Search history** — localStorage `emthao.history`, cap 20, dedupe on
  re-run. Dropdown under the search input. No backend.
- **FR-22 Pagination** — `?page=N` on the backend; "Load more" button on the
  frontend. Mercari uses in-response slicing (API returns ~120 by default);
  Yahoo uses `&b=<offset>` URL param; PayPay no-op.
- **FR-23 Filters** — client-side price min/max + condition multi-select.
  Applied after fetch. Phase 2 will move to backend params.
- **FR-24 Cache bypass** — `?nocache=1` skips the server cache read (still
  writes); a "Refresh" button on the search bar issues this for mid-session
  reloads when sellers post new items.

Spec: `Requirements/search-extras.md`.

## What's left for Phase 1

### Frontend (in progress) — `frontend/`

- `npm create vite@latest -- --template react` in `frontend/`
- Components in `src/components/`:
  - Search side: `SearchBar`, `WeightInput`, `SourceTabs`, `YahooModeFilter`, `SortControls`, `ResultCard`, `PriceBlock`, `SkeletonCard`, `ImageSearchTab` (placeholder)
  - Bookmarks (FR-20): `BookmarkButton`, `BookmarksView`, top-level `ViewToggle` (Search ↔ Bookmarks tab)
- Hooks:
  - `useSearch` — parallel-source loading state, partial results
  - `usePersistentState` — generic localStorage helper
  - `useBookmarks` — `{ bookmarks, isBookmarked(url), toggle(item), remove(url), count }`, keyed by `item.url`, persisted at `emthao.bookmarks` with FIFO 200-item cap
- `lib/translateUrl.js` — `<host-with-dashes>.translate.goog/...?_x_tr_sl=ja&_x_tr_tl=en&_x_tr_hl=en`
- `lib/pricing.js` — `jpyToVnd(jpy, weightKg, cfg)` client-side
- `api/search.js` — fetch wrapper with 3-attempt retry (1s/2s/4s)
- `App.jsx` composes the layout, owns the Search ↔ Bookmarks toggle
- `.env.example` with `VITE_API_BASE_URL=http://localhost:8787`

### Production deploy
- Push to GitHub
- Vercel: import → root `frontend/` → set `VITE_API_BASE_URL` env var
- Render: New Web Service → repo auto-detects `backend/render.yaml`
- After Vercel URL is known: set `ALLOWED_ORIGIN` env in Render to the Vercel domain

## How to resume next session

```bash
# 1. Boot backend
cd /Users/phuctph/Desktop/EmThao/backend
npm install              # if node_modules missing
npx playwright install chromium   # if browser missing
cp -n .env.example .env
npm run dev              # listens on :8787

# 2. Quick verify
curl http://localhost:8787/health
curl 'http://localhost:8787/search?q=iphone&limit=3' | jq '.count'

# 3. Then build the frontend (next task)
```

Read these to come back up to speed:
1. This file (Plan.md)
2. `.claude/Claude.MD` — project briefing
3. `backend/src/scrapers/mercari.skill.md`
4. `backend/src/scrapers/yahoo.skill.md`
5. `backend/src/scrapers/paypay.skill.md`
6. `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md` — full multi-phase plan

## Phases 2-5 (untouched)

See full plan file. Key pending items:
- **Phase 2:** Upstash Redis cache, retry-with-backoff per scraper, server-side filters, structured logging dashboards.
- **Phase 3:** Image search via FastAPI + CLIP + Qdrant.
- **Phase 4:** Clerk auth, Neon Postgres, bookmarks, price-alert email cron.
- **Phase 5:** Webshare proxy rotation (also unblocks PayPay), rate limiting, Grafana dashboard.

## Open questions for next session

- Confirm port `8787` and `npm` package manager are still good.
- Decide whether to deploy backend immediately to Render to test PayPay from Singapore IP, or build frontend first and deploy both at once.
- If PayPay still fails from Singapore, decide whether to advance Phase 5 proxies into Phase 1 scope, or accept 2-source MVP.
