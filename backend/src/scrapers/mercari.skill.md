# Mercari scraper — mechanism and maintenance

**File:** `mercari.js`
**Strategy:** JSON API interception (NOT DOM scraping)
**Status (2026-05-10):** ✅ Working from any IP, returns canonical JPY prices

---

## Why API interception, not DOM

Mercari (`jp.mercari.com`) is geo-aware:
- Server reads `CF-IPCountry` from Cloudflare and sets a `country_code` cookie.
- The rendered DOM shows prices in the visitor's currency.
- From a Vietnam IP we got `"VND855,500"` for a fan whose actual price is `¥4,800`.

Client-set `country_code` cookies are **ignored** — the value is server-authoritative. Tried it, doesn't work.

Mercari is also a CSR React app now: no `__NEXT_DATA__`, no `__INITIAL_STATE__`, items hydrate from the API after JS boot. So DOM scraping is doubly fragile.

The JSON API at `https://api.mercari.jp/v2/entities:search` returns prices in plain JPY regardless of geo, and exposes structured fields we'd otherwise have to scrape.

## How the scraper works

1. Open a Playwright page.
2. Register a `page.waitForResponse(...)` listener for the API URL **before** navigation (otherwise we miss it on fast loads).
3. Navigate to `https://jp.mercari.com/search?keyword=<q>`.
4. When the API response fires, parse JSON and read `body.items[]`.
5. Map each item through `toItem()` in `normalize.js`.

```js
const apiResponsePromise = page.waitForResponse(
  (resp) => resp.url().includes('/v2/entities:search') && resp.request().method() === 'POST',
  { timeout: 12000 }
);
await page.goto(url, { waitUntil: 'domcontentloaded' });
const resp = await apiResponsePromise;
const body = await resp.json();
```

## Item shape (from API)

```jsonc
{
  "id": "m46729258794",
  "name": "FRAIS ハンディファン ピンク　フランフラン",
  "price": "4800",                        // string JPY
  "thumbnails": ["https://..."],          // grid-card sized
  "photos": [{ "uri": "https://..." }],   // detail-page sized
  "itemConditionId": "1",                 // 1–6, mapped via CONDITION_MAP
  "status": "ITEM_STATUS_ON_SALE",        // also _SOLD_OUT, _STOP, _TRADING
  "auction": null,                        // non-null for auction-style
  "shop": null                            // non-null for Mercari Shops listings
}
```

Condition map (kept inline in the scraper):
| id | label |
|---|---|
| 1 | 新品、未使用 |
| 2 | 未使用に近い |
| 3 | 目立った傷や汚れなし |
| 4 | やや傷や汚れあり |
| 5 | 傷や汚れあり |
| 6 | 全体的に状態が悪い |

## Filtering applied at scrape time (added 2026-05-10)

To avoid surfacing items that 404 or show 「エラーが発生しました」 when the user clicks, the scraper drops:

- `status !== 'ITEM_STATUS_ON_SALE'` — sold-out, in-trade, or stopped listings.
- `itemType !== 'ITEM_TYPE_MERCARI'` — Mercari Beyond / Shops listings whose URL routing under `/item/<id>` does not always resolve cleanly. Their IDs use a different alphanumeric pattern (e.g. `P9oQg44DuFfEzoSHLUGtfE`).
- `shop != null` — same as above, redundant safety net for shop products.

Phase 2 may revisit Beyond/Shops support by detecting the right URL prefix per `itemType` (e.g. `/shops/product/<id>`) and re-including those items.

## Pagination (added 2026-05-10)

Mercari's `/v2/entities:search` returns ~120 items per response. We slice locally:

```js
const sliceStart = (pageNum - 1) * limit;
items = onSale.slice(sliceStart, sliceStart + limit);
```

This means pages 1-6 cost the same network round-trip as page 1. A user pressing **Load more** never re-hits the API for the first ~6 pages — the cached scraper invocation already has the data. Page 7+ still does a fresh navigation since we don't persist the page object across requests.

Phase 2 will switch to the API's `pageToken` / `searchConditionId` cursor for true cursor-based pagination beyond 120 items.

## Maintenance signals

- **`itemCount: 0` while `browserConnected: true`** → API URL or shape changed. First step: re-run `node scripts/debug-mercari.js` to inspect the API response live.
- **`status: 'no-api-response'`** in logs → the response listener timed out. Either Mercari changed the API path, or the page didn't trigger the call (e.g. Cloudflare interstitial). Test: load the URL in headed Playwright (`headless: false`) to see what's actually rendered.
- **Suddenly localized prices again** → Mercari may have moved JPY-canonical data behind an authenticated header. If so, falling back to `body.items[].itemPromotions` or revisiting the API request headers (`x-platform`, `dpop`) is the next escalation.

## Lessons learned

1. **Always register `waitForResponse` before `page.goto`.** Doing it after means the response can fire and resolve before you start listening.
2. **Mercari's response shape is stable across queries** — we can rely on `body.items[].price` being a string. Don't over-defensively `parseInt(it.price ?? it.priceText ?? ...)` — keep the parse explicit so a shape change fails loud.
3. **Don't scrape thumbnails OR photos blindly.** `photos[0].uri` is detail-page sized (~900×1200, slow to render in a grid). Prefer `thumbnails[0]` for cards; only fall back to `photos[0]` if missing.
4. **The `affiliate/user/v1/current_user` 403** that fires alongside the search request is harmless. Don't add it to the wait list.
5. **`m46729258794` style item IDs** prefix tells you the storage shard — they're stable forever. Build the URL as `https://jp.mercari.com/item/${id}`.

## Future-proofing ideas

- **Phase 2:** call `https://api.mercari.jp/v2/entities:search` directly with `context.request.post(...)` after one page load to grab the auth cookies. Skips the ~3 s JS bootstrap entirely.
- **Phase 3:** also store `body.searchConditionId` per query — Mercari can paginate using it as a cursor on subsequent calls.
- **If the API is ever locked behind DPoP/x-platform headers**, capture them once via interception then replay them on direct API calls.
