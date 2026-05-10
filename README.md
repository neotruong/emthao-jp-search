# EmThaoJPSearch

Internal Japanese marketplace search aggregator (Mercari + Yahoo Auctions + PayPay Flea Market).

Spec: `Requirements/`
Plan: `~/.claude/plans/1-project-summary-emthaojpsearch-jiggly-fern.md`

## Layout

- `backend/` — Node 20 + Express + Playwright. Deploys to Render (free).
- `frontend/` — Vite + React (Phase 1, *not built yet*). Deploys to Vercel.

## Backend dev

```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

### Verify boot

```bash
curl http://localhost:8787/health
# → {"status":"ok","cacheEntries":0,"browserConnected":true}
```

### Verify search across all 3 sources

```bash
curl -s 'http://localhost:8787/search?q=fan&yahooMode=all' \
  | jq '{count, perSource: (.results | group_by(.source) | map({source: .[0].source, n: length}))}'
```

### Per-source check

```bash
curl -s 'http://localhost:8787/search?q=iphone&sources=mercari'  | jq '.count, .results[0]'
curl -s 'http://localhost:8787/search?q=iphone&sources=yahoo&yahooMode=fixed' | jq '.count, .results[0]'
curl -s 'http://localhost:8787/search?q=iphone&sources=paypay'   | jq '.count, .results[0]'
```

### Cache hit

```bash
curl -s 'http://localhost:8787/search?q=test' | jq '.cached'  # false
curl -s 'http://localhost:8787/search?q=test' | jq '.cached'  # true (within 7 min)
```

## Backend deploy (Render)

1. Push the repo to GitHub.
2. Render → New Web Service → connect repo → it picks up `backend/render.yaml` (Docker, free plan).
3. Set `ALLOWED_ORIGIN` to the Vercel URL once the frontend is up.

**Cold-start expectation:** Render free sleeps after 15 min idle. First request after sleep takes ~30–60s while the dyno spins up + warms Chromium.

## Scraper notes (Phase 1)

- **Mercari** intercepts `https://api.mercari.jp/v2/entities:search` JSON response and reads canonical JPY prices + condition codes. We do *not* DOM-scrape the listing cards because Mercari sets a `country_code` cookie from the request's geo-IP (e.g. `VN` from a Vietnam connection) and renders localized prices in the DOM (¥4,800 displays as VND855,500). The API ignores the localization.
- **Yahoo Auctions** uses DOM scraping on `.Product` BEM classes. The mode (auction vs fixed-price) is taken from the request's `yahooMode` param when filtered, since the Yahoo URL filter (`fixed=1` / `fixed=2`) guarantees that every returned listing is the requested mode.
- **PayPay Flea Market** is **geo-blocked outside Japan**. Both your local dev IP (Vietnam) and Render's Singapore region will see the page render `「データの取得に失敗しました」` (Data retrieval failed) and fall back to generic "あなたへのおすすめ" (recommendations). The scraper detects this state and returns `[]` rather than polluting results with unrelated items. Real PayPay results require a JP residential proxy → tracked for **Phase 5**.

## Known limitations (Phase 1)

- PayPay returns 0 results from non-JP IPs (see above). Plan to fix in Phase 5 with Webshare proxies.
- Cache is in-memory (`lru-cache`), so it resets on every backend restart. Phase 2 swaps to Upstash Redis.
- No retry logic inside scrapers yet — Phase 2.
- Frontend not yet built — Phase 1 step 6.
