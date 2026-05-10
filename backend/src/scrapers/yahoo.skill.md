# Yahoo Auctions scraper — mechanism and maintenance

**File:** `yahoo.js`
**Strategy:** DOM scraping (server-rendered HTML, no JS needed for first paint)
**Status (2026-05-10):** ✅ Working, no geo issues, mode classification correct

---

## Why DOM scraping (not API)

Yahoo Auctions Japan (`auctions.yahoo.co.jp`) ships fully server-rendered listings: by the time `domcontentloaded` fires, every `<li class="Product">` is in the HTML with title, price, and image already present. The site does not localize prices by IP — JPY everywhere.

There's a JSON API path (`/api/...`) but it requires a Yahoo Japan session token that's not trivially extractable. The DOM is reliable enough to not bother.

## How the scraper works

1. Build the URL by mode:
   - `all` → `?p=<q>&va=<q>`
   - `auction` → `?p=<q>&va=<q>&fixed=2`
   - `fixed` → `?p=<q>&va=<q>&fixed=1`
2. Navigate, `waitForSelector('li.Product, .Product')`.
3. `$$eval` over each card, extracting the seven fields below.
4. Normalize through `toItem()`.

## Card selectors (verifiedAt 2026-05-10)

| Field | Selector |
|---|---|
| Card root | `li.Product` (preferred), fallback `.Product` |
| Title link | `.Product__titleLink` → `.Product__title a` → `a[href*="/auction/"]` (in fallback order) |
| Price | `.Product__priceValue` → `.Product__price` |
| Image | `.Product__image img` → `.Product__imageBox img` → first `img` |
| Bid count | `.Product__bid` → `.Product__bidValue` |
| Time left | `.Product__time` → `.Product__timeValue` |

## Mode field — important

When the request specifies `yahooMode=auction` or `yahooMode=fixed`, the URL param `fixed=2` / `fixed=1` already filters Yahoo's results — every returned listing is **guaranteed** to match. So the scraper assigns `mode: 'auction'` or `mode: 'fixed'` based on the request param, **not** per-card detection.

When `yahooMode=all`, fall back to the per-card heuristic: `mode: card.querySelector('.Product__icon--buynow') || /即決/.test(card.textContent) ? 'fixed' : 'auction'`. This heuristic is imperfect (auction listings can have a 即決 buy-now option) so we only use it when the URL hasn't already filtered.

## Item shape returned

```jsonc
{
  "title": "iPhone14《超美品》最新ios26.4.2 ...",
  "price": 47800,                       // integer JPY
  "image": "https://auc-pctr.c.yimg.jp/...",
  "url": "https://auctions.yahoo.co.jp/jp/auction/e1229439454",
  "condition": null,                    // not on listing card; would need detail-page fetch
  "source": "yahoo",
  "currency": "JPY",
  "bidCount": 3,                        // null for fixed-price
  "timeLeft": "残り 1日",
  "mode": "auction" | "fixed"
}
```

## Maintenance signals

- **`itemCount: 0` while `status: 'no-items'`** → `.Product` class is gone. Re-verify the listing-page DOM with DevTools, update `selectors.js` `verifiedAt` and the per-field selectors.
- **All prices are `null`** → `Product__priceValue` text changed. Probably surrounded by an `<em>` or split by a `<span class="bidPrice">` for separate yen/dollar. Inspect via headed browser.
- **All `mode: "auction"` even with `yahooMode=fixed`** → mode override not running. Check that `mode === 'fixed'` triggers the early return in the map step.

## Lessons learned

1. **Trust the URL filter, not card-level detection.** When `fixed=1` / `fixed=2` is in the URL, every result IS that mode. The 即決 badge inside cards conflates with auction-side buy-now prices and gives wrong classifications. We learned this when `fixed` mode results all came back tagged `auction`.
2. **`li.Product` and `.Product` co-exist** — Yahoo wraps each result in an `<li>` but also sets `.Product` directly elsewhere (mobile fallback). Selecting both keeps the scraper resilient.
3. **`Product__bidValue` has commas** — `"1,234"` for ≥1000 bids. Strip non-digits before parseInt; do NOT pass through `parsePrice` which assumes JPY.
4. **Yahoo's image CDN strips query params on cache busts** — don't rely on the `?w=600&h=600` suffix; treat the URL as opaque.

## Future-proofing ideas

- **Phase 2:** add `condition` extraction from the `Product__categoryLink` adjacent text (e.g. `中古` / `新品`). Some listings expose it; some don't.
- **Phase 2:** push `price_min` / `price_max` into Yahoo's URL params (`aucminprice`, `aucmaxprice`) instead of post-filtering.
- **Phase 4:** for price-alert cron, the listing detail page (`/jp/auction/<id>`) has a stable `.Product__priceValue` we can re-fetch cheaply.
