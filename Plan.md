# EmThaoJPSearch — Session Resumption Plan

> Use this file to pick up the build in a future Claude session. The full
> architecture / phase plan lives at
> `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`.

## Status

**Phase 1 — Done ✅ (deployed 2026-05-10)**

- **Repo:** https://github.com/neotruong/emthao-jp-search (public)
- **Backend (Render free, Singapore):** https://emthaojp-backend.onrender.com — ⚠️ migrating to Fly.io Tokyo (see below)
- **Frontend (Vercel free):** _set after Vercel deploy → e.g._ `https://emthao-jp-search.vercel.app`

### Backend host migration in progress (2026-05-11)

Render free's 0.1 CPU is a hard floor for Chromium scraping — even after tuning, scrape budgets are tight. Migrating to **Fly.io Tokyo (`nrt`)** because:

- 1 vCPU vs 0.1 — scrape budgets drop back to localhost-class (12 s vs 25 s).
- Tokyo region removes PayPay's geo-block (intermittent on SG IPs) — full 3-of-3 sources.
- Cost ≈ $3–5/mo with auto-suspend, similar to Render Starter ($7) but with way more CPU.

Config: `backend/fly.toml` (committed). Migration runbook: `INFRA.local.md` (local only — `flyctl install`, `fly auth login`, `fly deploy`).

Phase 1 acceptance criteria (from the canonical plan):
- ✅ User opens the public URL and searches a keyword.
- ✅ Results from at least 2 of 3 markets appear within ~8 s (Mercari + Yahoo).
- ✅ If one scraper fails, the others still show results (PayPay returns `[]` from non-JP IPs — Phase 5 fix).
- ✅ Cache works: second identical search returns `cached:true` in < 200 ms.

> 🔧 **TODO — fill in actual URLs above** once Render and Vercel finish deploying.

## Phase 1 — file map (built + verified)

### Backend (`backend/`, Node 20 + Express + Playwright → Render Docker)

| File | Purpose |
|---|---|
| `package.json` | Node 20, deps: express, playwright, lru-cache, p-limit (v3 CJS), pino, pino-pretty, cors, dotenv |
| `Dockerfile` | `mcr.microsoft.com/playwright:v1.49.0-jammy` base, `node src/server.js` |
| `render.yaml` | Free Web Service, Singapore region, `/health` health-check |
| `.env.example` | `PORT=8787`, `ALLOWED_ORIGIN`, `LOG_LEVEL` |
| `src/server.js` | Express app, CORS, warms Chromium before `app.listen` |
| `src/browser.js` | Singleton Chromium, restart-on-disconnect, `newContext()` with ja-JP / Asia-Tokyo / random UA |
| `src/cache.js` | `lru-cache` 7-min TTL, `cacheKey({q, sources, yahooMode, limit, page})` |
| `src/concurrency.js` | `paceDomain()` ≥ 1 s between hits to same host |
| `src/logger.js` | pino, pretty in dev, JSON in prod |
| `src/config/pricing.js` | `JPY_VND_RATE=185`, `MARKUP_PCT=20`, `SHIP_VND_PER_KG=175000`, `DEFAULT_WEIGHT_KG=0.2` |
| `src/config/selectors.js` | Versioned per-scraper selector map, `verifiedAt: '2026-05-10'` |
| `src/config/userAgents.js` | 8-string UA pool + `pickUA()` |
| `src/util/parsePrice.js` | `"¥12,345" → 12345` |
| `src/util/absoluteUrl.js` | resolve relative URLs |
| `src/scrapers/normalize.js` | `toItem()` → unified Item shape |
| `src/scrapers/mercari.js` | API interception of `/v2/entities:search`, drops sold-out + Beyond items |
| `src/scrapers/yahoo.js` | DOM scrape `li.Product`, mode taken from URL filter |
| `src/scrapers/paypay.js` | DOM scrape with geo-block detector → returns `[]` from non-JP IPs |
| `src/routes/search.js` | `GET /search?q=&sources=&yahooMode=&limit=&page=&nocache=` — cache + parallel scrapers + 12 s per-source timeout + dedup + pagination |
| `src/routes/health.js` | `GET /health` returning browser status + cache size |
| `scripts/debug-mercari.js` | Inspect Mercari API/DOM live |
| `scripts/debug-paypay.js` | Inspect PayPay API/DOM live |
| `scripts/smoke-frontend.js` | E2E smoke against the running stack |

### Frontend (`frontend/`, Vite + React → Vercel)

| File | Purpose |
|---|---|
| `index.html`, `vite.config.js`, `package.json` | Vite scaffold |
| `.env.example` | `VITE_API_BASE_URL` |
| `src/main.jsx`, `src/index.css`, `src/App.jsx`, `src/App.css` | Bootstrap + layout + styles (English UI) |
| `src/api/search.js` | fetch wrapper + 3-attempt retry (1 s / 2 s / 4 s) |
| `src/lib/translateUrl.js` | `<host-with-dashes>.translate.goog/...?_x_tr_sl=ja&_x_tr_tl=en&_x_tr_hl=en` |
| `src/lib/pricing.js` | `jpyToVnd(jpy, weightKg, cfg)` |
| `src/lib/labels.js` | JP→EN label maps for condition + Yahoo timeLeft |
| `src/lib/filters.js` | `applyClientFilters` + `vndToJpy` (currency-aware bounds) |
| `src/hooks/useSearch.js` | parallel-source loading state, append on `loadMore`, cache-bypass on `refresh` |
| `src/hooks/useBookmarks.js` | localStorage `emthao.bookmarks`, FIFO 200-cap |
| `src/hooks/useHistory.js` | localStorage `emthao.history`, cap 20, MRU dedupe |
| `src/hooks/usePersistentState.js` | generic localStorage helper, multi-tab sync via `storage` event |
| `src/components/SearchBar.jsx` | Search input + history dropdown + Refresh button |
| `src/components/WeightInput.jsx` | Locale-safe decimal input (accepts `.` or `,`), min 0.1 kg |
| `src/components/SourceTabs.jsx` | All / Mercari / Yahoo / PayPay |
| `src/components/YahooModeFilter.jsx` | All / Auction / Buy Now |
| `src/components/SortControls.jsx` | Relevance / Newest update / Price ↑ ↓ / Newest saved (bookmarks) |
| `src/components/FilterPanel.jsx` | Price range with JPY/VND currency toggle + condition multi-select |
| `src/components/ResultCard.jsx`, `PriceBlock.jsx` | Card with both prices + Translated/Original/heart |
| `src/components/BookmarkButton.jsx`, `BookmarksView.jsx` | FR-20 |
| `src/components/HistoryDropdown.jsx` | FR-21 |
| `src/components/SkeletonCard.jsx`, `ImageSearchTab.jsx`, `ViewToggle.jsx` | misc |

### Docs

- `README.md` — top-level setup + deploy
- `Plan.md` — this file
- `.claude/Claude.MD` — project briefing for future Claude sessions
- `Requirements/local-bookmarks.md` — FR-20 spec
- `Requirements/search-extras.md` — FR-21–FR-24 spec
- `backend/src/scrapers/{mercari,yahoo,paypay}.skill.md` — per-scraper mechanism + lessons

## Functional requirements coverage (Phase 1)

| ID | Feature | Status |
|---|---|---|
| FR-01 | Keyword search | ✅ |
| FR-02 | Parallel scraping | ✅ |
| FR-03 | Partial results on failure | ✅ |
| FR-04 | Normalized response | ✅ |
| FR-05 | Source filter | ✅ (client-side) |
| FR-06 | Sort controls | ✅ (relevance, newest, price ↑↓) |
| FR-07 | Result caching | ✅ (lru-cache, 7 min) |
| FR-08 | Server-side filters | ⏳ Phase 2 (currently client-side) |
| FR-09 | Pagination | ✅ (`?page=N`, Load More) |
| FR-10 | Retry logic | ✅ (frontend 3-attempt; per-scraper retry → Phase 2) |
| FR-11–14 | Image search | ⏳ Phase 3 (UI placeholder only) |
| FR-15–19 | Auth + cloud bookmarks + alerts | ⏳ Phase 4 |
| FR-20 | Local bookmarks | ✅ |
| FR-21 | Local search history | ✅ |
| FR-22 | Pagination | ✅ |
| FR-23 | Client filters (price + condition + JPY/VND toggle) | ✅ |
| FR-24 | Cache-bypass refresh | ✅ |

## Resume locally

```bash
# 1. Boot backend
cd backend
npm install
npx playwright install chromium     # one-time
cp -n .env.example .env
npm run dev                         # :8787

# 2. Boot frontend
cd ../frontend
npm install
cp -n .env.example .env
npm run dev                         # :5173

# 3. Quick verify
curl http://localhost:8787/health
curl 'http://localhost:8787/search?q=iphone&limit=3' | jq '.count'
```

Read these to come back up to speed:
1. `Plan.md` (this file)
2. `.claude/Claude.MD` — project briefing
3. `backend/src/scrapers/{mercari,yahoo,paypay}.skill.md`
4. `Requirements/{local-bookmarks,search-extras}.md`
5. `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md` — full multi-phase plan

## Production runbook (Phase 1 deploy)

### Backend → Render free
- Service: `emthaojp-backend` (Docker, Singapore, free plan).
- Reads `backend/render.yaml`. Auto-deploy on push to `main`.
- Cold start ~30–60 s after 15 min idle.
- Logs in Render dashboard. Health: `GET /health`.
- Required env: `NODE_ENV=production`, `PORT=8787`, `ALLOWED_ORIGIN=<vercel URL>`, `LOG_LEVEL=info`.

### Frontend → Vercel free
- Project root: `frontend/`
- Build command: `npm run build` (Vite default)
- Output: `dist`
- Required env: `VITE_API_BASE_URL=<render URL>`
- Auto-deploy on push to `main`.

### Common ops
- **PayPay returns `[]`** from Render Singapore — expected; geo-block fix in Phase 5.
- **Memory pressure on free tier** (Chromium ≈ 250–300 MB + Node ≈ 100 MB on a 512 MB box) — upgrade to Render Starter ($7/mo) if `OOMKilled` shows up in logs.
- **First production build is slow** (~8 min) because of the Playwright base image; subsequent deploys reuse layers.

## Phases 2 – 5 (next work)

Full detail in `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`.

- **Phase 2 (~$5/mo):** Upstash Redis cache (replace `lru-cache`); per-scraper retry with backoff; promote client filters to backend (`price_min/max/condition`); selector breakage canary.
- **Phase 3 (~$10/mo):** FastAPI + CLIP + Qdrant for image search; nightly indexer cron; wire `ImageSearchTab.jsx`.
- **Phase 4 (~$10/mo):** Clerk auth + Neon Postgres; sync local bookmarks/history to cloud on first login; price-drop alerts via Resend.
- **Phase 5 (~$15/mo):** Webshare residential JP proxy (unblocks PayPay); Redis rate limiting (30 req/min/IP); Grafana Cloud dashboard.

## Known limitations carried into Phase 2+

- PayPay results are 0 from any non-JP IP. Need Phase 5 proxy.
- Free-tier cold start is visible to first user after idle; consider an UptimeRobot ping or upgrade to Starter when traffic exists.
- Scraper retry lives only on the frontend right now (Phase 2 will add per-source backoff in the scraper itself).
