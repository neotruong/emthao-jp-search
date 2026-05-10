# Search extras — history, pagination, filters, cache bypass

**Status:** Phase 1 (added 2026-05-10 after initial frontend smoke-test).
Together these four small features close out the Phase 1 search experience.

## FR-21 — Local search history

Lightweight recency list, no backend, no auth.

- **Storage:** `localStorage` key `emthao.history`. Value is `HistoryEntry[]` where each entry is `{ q, ts, sources?, yahooMode? }`.
- **Cap:** 20 entries (matches the original FR-17 spec for cloud history). Oldest evicted FIFO when cap exceeded.
- **Dedupe:** if the user re-runs an existing query, that entry is removed from its current position and re-inserted at the top with a new `ts`.
- **UX:** when the search input is focused, a dropdown appears listing the most recent N queries (most recent first). Clicking an entry runs the search. A small × on each entry removes it from the list. A "Clear history" link at the bottom of the dropdown empties the entire list.
- **Privacy:** since this is purely localStorage, clearing browser data clears the history. Phase 4 cloud history will sync this on first login (same upgrade path as bookmarks).

## FR-22 — Pagination ("Load more")

- API: `GET /search?page=N&limit=20&...`. `page` is 1-indexed, default 1. Cache key includes the page number.
- **Mercari:** the API response carries up to ~120 items. Scraper slices `apiItems.slice((page-1)*limit, page*limit)`. No additional network round-trip — the same response covers the first ~6 pages.
- **Yahoo:** add `&b=<offset>&n=<limit>` to the listing URL where `offset = (page-1)*limit + 1` (Yahoo is 1-indexed). Each page = one fresh navigation.
- **PayPay:** geo-blocked from non-JP IPs; pagination is a no-op until Phase 5 proxies.
- **UX:** a **Load more** button at the bottom of the result grid. Clicking it triggers `page+1`. The new results are *appended* (not replaced) to the existing grid. Button hides when the most recent page returned 0 items from every selected source.
- Bookmark state is preserved across page loads since it's keyed by URL.

## FR-23 — Filters (client-side)

A `FilterPanel` shown above the result grid. All filters apply on the client, instantly, with no re-fetch.

- **Price min / max** — currency toggle between **JPY (¥)** and **VND (đ)**.
  - In JPY mode the bounds compare directly against `item.price`.
  - In VND mode the bounds are converted to JPY using
    `JPY = (VND − weightKg × shipVndPerKg) / (rate × (1 + markupPct/100))`
    (the inverse of the per-card VND formula). Implementation: `vndToJpy()` in `frontend/src/lib/filters.js`.
  - JPY and VND bounds are stored independently (`priceMin`/`priceMax` and `vndMin`/`vndMax`); toggling currency does NOT clear the inactive set, so a user can stack both bounds (intersection). Reset Filters clears all four.
  - Items with `price = null` always pass (rather than being silently dropped).
- **Condition** — multi-select pills mapped to backend Japanese strings via `frontend/src/lib/labels.js`:
  - "New" (新品 / 新品、未使用)
  - "Near new" (未使用に近い / 未使用)
  - "Lightly used" (目立った傷や汚れなし / 良好)
  - "Used" (やや傷や汚れあり / 中古)
  - "Heavily used" (傷や汚れあり / 全体的に状態が悪い / 可)
  - "Unspecified" — items without a `condition` field
- Filters compose with the existing source tabs and Yahoo mode filter. The filtered count is shown next to the original count (`12 of 40`).
- Phase 2 will move this to the backend (`price_min`, `price_max`, `condition` query params) so paginated results respect the filter without over-fetching.

## FR-24 — Cache bypass ("Refresh")

- API: `GET /search?nocache=1&...` makes the route skip the cache *read* but still write the result to cache (so subsequent normal calls benefit). Useful when sellers post new items mid-session.
- **UX:** a **Refresh** button (circular-arrow icon) next to the search submit. Clicking it re-issues the most recent search with `nocache=1` and resets pagination to page 1.
- Visual: the button shows a spinning state while the refresh is in flight; when done, the existing `cached` badge is suppressed for the result of this call.

## Out of scope

- Persistent server-side history (Phase 4 — needs auth).
- Server-side filter application (Phase 2 — current Phase 1 client-side filter is sufficient because we already over-fetch up to 60 items per source per page).
- Per-source pagination cursors (Phase 2). Phase 1 uses uniform offset-based pagination across sources.
