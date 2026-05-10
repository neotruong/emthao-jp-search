# FR-20 — Local Bookmarks

**Status:** Phase 1 (frontend, in progress as of 2026-05-10)
**Scope:** client-side only, no backend, no authentication

## Why this is in Phase 1

The original plan placed bookmarks in Phase 4 (Clerk auth + Neon Postgres). Bringing a *local-only* version forward into Phase 1 lets a single user save favorites immediately, without waiting for the user-account work, and at zero infrastructure cost.

When Phase 4 ships, the user-account bookmark feature will *upgrade* the local store: existing local bookmarks get synced to the cloud on first login, then the cloud store becomes authoritative.

## Behavior

- A heart/star toggle appears on every `ResultCard`. Clicking it adds or removes the item from the user's bookmarks.
- A top-level **Bookmarks** view (alongside the search view) lists all saved items as cards using the same card component.
- Bookmarks persist across browser sessions via `localStorage`.
- The bookmark count appears as a badge on the Bookmarks tab.
- The user can remove a bookmark from either the search results or the Bookmarks view.
- Each bookmark card retains the "View Original" / "View Translated" links and shows the same JPY + VND price block as a search result.

## Storage

- Key: `emthao.bookmarks`
- Value: JSON array of `Item` (same shape as `/search` results) plus a `savedAt` ISO timestamp.
- Cap: 200 entries to stay well under the ~5 MB localStorage quota. Oldest is evicted when the cap is exceeded (FIFO by `savedAt`).
- Schema versioning: a sibling key `emthao.bookmarks.version = 1` lets us migrate cleanly when Phase 4 introduces cloud sync.

## VND recompute on bookmarks

The bookmark store keeps the **canonical JPY price**. The Bookmarks view reads the user's current weight + the live `pricing` config from the most recent search response (also cached in `localStorage` under `emthao.pricing`) to render VND. If no search has happened in this session, the bookmark view falls back to the defaults baked into the backend config. This means changing the rate or markup on the backend is reflected on bookmark cards on the next reload.

## Out of scope (deferred to Phase 4)

- Cross-device sync.
- User authentication.
- Sharing a bookmark list with another user.
- Price-drop alerts (Phase 4 still owns this; alerts require a server-side cron and an email service).

## Acceptance criteria

1. User clicks the heart icon on a search result → card shows it as bookmarked, count badge increments.
2. User reloads the page → the bookmark is still there.
3. User opens the Bookmarks view → the saved item appears with the same title, image, price, and source badge.
4. User changes the weight input → VND on bookmark cards updates without a re-fetch.
5. User clicks the heart icon a second time → card shows unbookmarked, count badge decrements, bookmark is removed from `localStorage`.
6. Bookmarks survive when the search query changes or the browser tab is closed and reopened.

## Implementation notes

- `frontend/src/hooks/useBookmarks.js` exposes `{ bookmarks, isBookmarked(url), toggle(item), remove(url), count }`.
- Bookmarks are keyed by `item.url` (unique per listing across all 3 sources).
- The bookmark write triggers a `storage` event so multiple tabs stay in sync.
- The Bookmarks view sorts by `savedAt` desc by default; the existing `SortControls` can re-sort by price/title.
