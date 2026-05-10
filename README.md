# EmThaoJPSearch

Internal Japanese marketplace search aggregator: one keyword → unified results from **Mercari**, **Yahoo Auctions**, and **PayPay Flea Market**, with both JPY and VND prices on every card.

| | |
|---|---|
| **Repo** | https://github.com/neotruong/emthao-jp-search |
| **Backend** | Render free (Singapore) — _set after deploy_ |
| **Frontend** | Vercel free — _set after deploy_ |
| **Status** | Phase 1 done ✅ (deployed 2026-05-10). Phases 2–5 in `Plan.md` |

Spec: `Requirements/` · Resumption doc: `Plan.md` · Project briefing: `.claude/Claude.MD` · Multi-phase plan: `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`

## Layout

- `backend/` — Node 20 + Express + Playwright → Render (Docker)
- `frontend/` — Vite + React (English UI) → Vercel
- `Requirements/` — feature specs (`local-bookmarks.md`, `search-extras.md`)
- `backend/src/scrapers/{mercari,yahoo,paypay}.skill.md` — per-source mechanism + maintenance lessons

## Local dev

```bash
# Backend
cd backend
npm install
npx playwright install chromium     # one-time
cp -n .env.example .env
npm run dev                         # :8787

# Frontend (separate terminal)
cd frontend
npm install
cp -n .env.example .env
npm run dev                         # :5173
```

Open `http://localhost:5173`.

### Backend smoke

```bash
curl http://localhost:8787/health
# → {"status":"ok","cacheEntries":N,"browserConnected":true}

curl -s 'http://localhost:8787/search?q=iphone&limit=3' \
  | jq '{count, cached, sources, first: .results[0] | {source, price, title}}'

# Cache hit (run twice within 7 min)
curl -s 'http://localhost:8787/search?q=test' | jq '.cached'  # false
curl -s 'http://localhost:8787/search?q=test' | jq '.cached'  # true

# Pagination + cache bypass
curl -s 'http://localhost:8787/search?q=iphone&page=2'         | jq '.count'
curl -s 'http://localhost:8787/search?q=iphone&nocache=1'      | jq '.cached'  # always false
```

### End-to-end smoke (browser-driven)

`backend/scripts/smoke-frontend.js` drives the running stack with Playwright through search → pagination → filters → bookmark → history → reload-persistence.

```bash
cd backend && node scripts/smoke-frontend.js
```

## Production deploy

### Backend → Render

1. Push to `main`.
2. **Render → New → Blueprint** → connect `neotruong/emthao-jp-search` → it reads `backend/render.yaml` (Docker, Singapore, free plan).
3. Set `ALLOWED_ORIGIN` env to the Vercel URL once the frontend is up. Until then, `*` is fine.

**Cold start:** Render free sleeps after 15 min idle. First request after sleep takes ~30–60 s while the Docker container wakes and Chromium warms.

**Memory + CPU:** Chromium ≈ 250–300 MB + Node ≈ 100 MB on a 512 MB free instance. CPU is throttled to **0.1 CPU** which makes `page.goto` slow; the first deploy returned `count: 0` because the default 12 s scraper budget wasn't enough. The current `render.yaml` bakes `SCRAPER_TIMEOUT_MS=25000` and `SCRAPE_CONCURRENCY=2` for this reason. If you upgrade to **Starter ($7/mo, 0.5 CPU)**, drop the timeout back to ~12000 and raise concurrency to 3.

**Resource blocking:** `browser.js` aborts image/media/font requests inside Playwright contexts — we never inspect them anyway and they were ~80 % of the bytes per page on slow hosts.

### Frontend → Vercel

1. **Vercel → Add New → Project** → import the same GitHub repo.
2. **Root Directory:** `frontend`.
3. Env: `VITE_API_BASE_URL = https://<your-render-url>.onrender.com`.
4. Build/output are Vite defaults (`npm run build` → `dist`).
5. After first deploy, copy the Vercel URL back into Render's `ALLOWED_ORIGIN`.

## How the scrapers work (one-liners)

- **Mercari** — intercepts the JSON API at `https://api.mercari.jp/v2/entities:search` and reads canonical JPY prices and condition codes. DOM scraping is unreliable because Mercari sets a `country_code` cookie from the request's geo-IP (e.g. `VN` from a Vietnam connection) and renders prices in local currency in the DOM. The scraper also drops items that aren't `ITEM_STATUS_ON_SALE` and skips Mercari Beyond/Shops items (those `P9oQg…`-style IDs that 404 on click).
- **Yahoo Auctions** — DOM scrape on `li.Product`. Mode (auction vs fixed-price) is taken from the request's `yahooMode` param because the Yahoo URL filter (`fixed=1` / `fixed=2`) guarantees every returned listing matches. Pagination via `&b=<offset>&n=<limit>`.
- **PayPay Flea Market** — geo-blocked outside Japan. Render Singapore IPs hit the same `「データの取得に失敗しました」` page that local dev does and fall back to generic recommendations. The scraper detects this state and returns `[]` rather than polluting results. Phase 5 residential proxy will fix it.

Detailed mechanism + selectors + maintenance signals per scraper in
`backend/src/scrapers/{mercari,yahoo,paypay}.skill.md`.

## Known limitations (Phase 1)

- **PayPay** returns 0 results from non-JP IPs (Render Singapore included). Phase 5 residential proxy fixes this.
- **In-memory cache** resets on every backend restart. Phase 2 → Upstash Redis behind the same `cache.js` interface.
- **Filters are client-side** (price min/max, condition pills, JPY/VND toggle). Phase 2 promotes them to backend `?price_min/max/condition` params.
- **Per-scraper retry** is frontend-only (3-attempt backoff). Phase 2 adds in-scraper retry.

## Phases 2 – 5

Roadmap in `Plan.md` and the canonical plan. Highlights:

- **Phase 2** (~$5/mo) — Upstash Redis, server-side filters, scraper retry, structured log metrics.
- **Phase 3** (~$10/mo) — FastAPI + CLIP + Qdrant for image search; nightly indexer.
- **Phase 4** (~$10/mo) — Clerk auth + Neon Postgres; sync local bookmarks/history to cloud; price-drop email alerts via Resend.
- **Phase 5** (~$15/mo) — Webshare residential JP proxy (unblocks PayPay), Redis rate limiting, Grafana Cloud dashboard.
