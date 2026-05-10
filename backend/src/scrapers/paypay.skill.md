# PayPay Flea Market scraper — mechanism and maintenance

**File:** `paypay.js`
**Strategy:** DOM scrape with a geo-block detector that returns `[]` when search isn't available
**Status (2026-05-10):** ⚠️ Returns `[]` from non-JP IPs (expected). Real fix in Phase 5 (residential JP proxy).

---

## Why this scraper currently returns `[]`

PayPay Flea Market (`paypayfleamarket.yahoo.co.jp`) is **geo-restricted**. From a non-JP IP (Vietnam confirmed; Render Singapore likely; same applies to most non-JP cloud regions), the search page renders:

> 「データの取得に失敗しました」 (Data retrieval failed)

…and below it, an "あなたへのおすすめ" (Recommended for you) section populated by the `/api/v1/recommend/items?recommendType=fleamarket_web_search` endpoint. **Those 96 items are unrelated to the search query** — searching for "fan" or "iphone" returns the same brooch / Switch / clothing results.

If we DOM-scraped the visible items in this state, every search would return a polluted list of irrelevant items. Worse than no results.

The scraper therefore checks for both marker strings together. If both are present, it logs `status: 'geo-blocked'` and returns `[]`. The `/search` route handles this transparently — the user just sees results from Mercari + Yahoo, no error.

## When the geo-block resolves (Phase 5 / JP IP)

When the request originates from a JP IP, search results render correctly. The DOM still uses generated class names (e.g. `sc-698fe364-0`), so we scrape via `a[href*="/item/"]` anchors and parse text inside each:

- `href` → relative URL (`/item/z607434812`); resolved to absolute.
- `<img alt="...">` → title (sourced from image alt, since titles aren't on the search card directly).
- `<img src="...">` → image URL.
- `innerText` matches `/([\d,]+)\s*円/` for price.

This already runs (and was tested via debug script when items were briefly visible). Once the geo-block lifts, the scraper's normal path will produce real results.

## Item shape (when working)

```jsonc
{
  "title": "ハートフルストロベリーギフト ジェラトーニ ブローチ ...",
  "price": 1400,
  "image": "https://auc-pctr.c.yimg.jp/...",
  "url": "https://paypayfleamarket.yahoo.co.jp/item/z607434194",
  "condition": null,           // not on listing card
  "source": "paypay",
  "currency": "JPY"
}
```

The internal JSON API at `/api/v1/recommend/items?recommendType=fleamarket_web_search&resultNum=96` exposes a richer shape (`itemId`, `title`, `price`, `image.url`, `likeCount`, `seller.id`) but **does not accept the search keyword** — it's a recommendation endpoint despite the URL name. Don't be fooled. There is presumably a real search API behind authenticated cookies; we haven't located it.

## Maintenance signals

- **All searches return `[]` with `status: 'geo-blocked'` in logs** → expected from non-JP IPs. Confirms the detector is working. Not a bug.
- **Returns `[]` with `status: 'no-anchors'`** → the page didn't render any `a[href*="/item/"]` at all. Either Cloudflare interstitial or a routing change. Inspect with `node scripts/debug-paypay.js`.
- **Returns wrong items (e.g. searching "fan" but getting Disney brooches)** → the geo-block detector failed to fire. Either Yahoo changed the error string ("データの取得に失敗しました") or the recommendations heading. Update `GEO_FAIL_MARKERS` in the scraper.

## Lessons learned

1. **Don't trust visible items just because they exist.** PayPay renders 96 anchors when search fails — without the marker check we'd return them as if they were search hits, every query returning the same useless list. Detect the failure state, return empty.
2. **The "recommend" API is not a search API.** The URL `recommendType=fleamarket_web_search` is misleading. Always verify by querying two different keywords and comparing — if results are identical, it's recommendations not search.
3. **Geo-blocking applies at the search-execution layer, not page load.** The marketing page, item-detail pages, and recommendations all work from non-JP IPs. Only search itself fails. Don't generalize "PayPay is blocked" too broadly.
4. **PayPay uses image `alt` for the listing title** — the visible card doesn't have a title element separate from the image. Don't waste time hunting for `<h3>` or `[class*="title"]`.

## Future-proofing ideas

- **Phase 5 (planned):** route requests through a JP residential proxy (Webshare). Inject via `browser.newContext({ proxy: { server, username, password } })`. Once active, expected to remove the geo-block immediately.
- **Alternative path:** Sign in with a Yahoo Japan account to get session cookies and call the (presumed) authenticated search API directly. Requires legal review re: ToS for an internal tool.
- **Detection of a JP-region deploy:** when the scraper successfully returns items for two distinct queries (different titles), we can declare PayPay "live" and surface it in the source filter. Until then, the UI should show PayPay as `unavailable` to avoid confusing the user.
