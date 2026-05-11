# EmThaoJPSearch

Internal Japanese marketplace search aggregator: one keyword → unified results from **Mercari**, **Yahoo Auctions**, and **PayPay Flea Market**, with both JPY and VND prices on every card.

| | |
|---|---|
| **Repo** | https://github.com/neotruong/emthao-jp-search |
| **Backend** | Render free (Singapore) → migrating to Fly.io Tokyo for better CPU + no PayPay geo-block ([why](#backend-host-migration-render--flyio)) |
| **Frontend** | Vercel free — _set after deploy_ |
| **Status** | Phase 1 done ✅ (deployed 2026-05-10). Phases 2–5 in `Plan.md` |

Spec: `Requirements/` · Resumption doc: `Plan.md` · Project briefing: `.claude/Claude.MD` · Multi-phase plan: `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`

## Layout

- `backend/` — Node 20 + Express + Playwright → Render (Docker)
- `frontend/` — Vite + React (English UI) → Vercel
- `Requirements/` — feature specs (`local-bookmarks.md`, `search-extras.md`)
- `backend/src/scrapers/{mercari,yahoo,paypay}.skill.md` — per-source mechanism + maintenance lessons

## Local dev

### One-command (recommended)

```bash
./start.sh
```

First run installs both workspaces, downloads Playwright Chromium, and copies the `.env` files. Subsequent runs just boot both servers in parallel (Ctrl+C stops both). Requires Node 20+.

Open `http://localhost:5173` once the BACK / FRONT panels print "listening".

Equivalent npm flow if you prefer:

```bash
npm install          # one-time, installs concurrently
npm run setup        # one-time, installs both workspaces + Playwright + .env files
npm run dev          # any time, runs backend (:8787) + frontend (:5173) concurrently
```

### Manual (two terminals)

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

### Backend → Fly.io Tokyo (recommended)

```sh
brew install flyctl
fly auth login
cd backend
fly apps create emthaojp-backend           # adjust name if taken
fly deploy --remote-only                    # uses backend/fly.toml
```

`fly.toml` ships with sensible defaults: Tokyo region, 1 vCPU / 1 GB, auto-stop machines (scale-to-zero ⇒ ~$3–5/mo), `/health` health-check, `SCRAPER_TIMEOUT_MS=12000`, `SCRAPE_CONCURRENCY=3`. After Vercel is up, lock CORS:

```sh
fly secrets set ALLOWED_ORIGIN=https://your-vercel-url.vercel.app
```

**Why Tokyo, not Singapore:** PayPay geo-blocks non-JP IPs intermittently; Tokyo IPs always pass. Mercari/Yahoo navigation also drops from ~80 ms to ~2 ms RTT.

### Backend → Render (alternative / current)

```sh
# Blueprint flow
# Render dashboard → New → Blueprint → pick neotruong/emthao-jp-search
# It reads backend/render.yaml (Docker, Singapore, free)
```

`render.yaml` bakes `SCRAPER_TIMEOUT_MS=25000` and `SCRAPE_CONCURRENCY=2` to survive 0.1 CPU + 512 MB. Set `ALLOWED_ORIGIN` to the Vercel URL after frontend deploy.

**Why migrating away:** the first prod deploy returned `count: 0` because Render free's 0.1 CPU couldn't finish 3 parallel `page.goto` calls in 12 s. Even with the larger 25 s budget, scrape latency is 8–15 s — Fly Tokyo gets it back to 2–4 s. PayPay also stays geo-blocked from Singapore.

#### Backend host migration (Render → Fly.io)

`INFRA.local.md` (gitignored) has the full step-by-step. tl;dr: install flyctl, `fly deploy` from `backend/`, retest, repoint Vercel `VITE_API_BASE_URL`, suspend the Render service.

**Resource blocking:** `browser.js` aborts image/media/font requests inside Playwright contexts — applied identically on both hosts. Saves 70–80 % of the bytes per page on every scrape.

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
