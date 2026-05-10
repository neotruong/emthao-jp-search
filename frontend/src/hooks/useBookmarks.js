import { useCallback, useMemo } from 'react';
import { usePersistentState } from './usePersistentState';

const STORAGE_KEY = 'emthao.bookmarks';
const VERSION_KEY = 'emthao.bookmarks.version';
const VERSION = 1;
const MAX_BOOKMARKS = 200;

// Initialise version key once so future migrations have an anchor.
try {
  if (typeof localStorage !== 'undefined' && !localStorage.getItem(VERSION_KEY)) {
    localStorage.setItem(VERSION_KEY, String(VERSION));
  }
} catch {
  /* SSR / disabled storage */
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = usePersistentState(STORAGE_KEY, []);

  const set = useMemo(() => new Set(bookmarks.map((b) => b.url)), [bookmarks]);

  const isBookmarked = useCallback((url) => set.has(url), [set]);

  const toggle = useCallback(
    (item) => {
      if (!item || !item.url) return;
      setBookmarks((prev) => {
        const exists = prev.some((b) => b.url === item.url);
        if (exists) return prev.filter((b) => b.url !== item.url);
        const next = [{ ...item, savedAt: new Date().toISOString() }, ...prev];
        // FIFO evict oldest if cap exceeded
        return next.slice(0, MAX_BOOKMARKS);
      });
    },
    [setBookmarks]
  );

  const remove = useCallback(
    (url) => {
      setBookmarks((prev) => prev.filter((b) => b.url !== url));
    },
    [setBookmarks]
  );

  const clear = useCallback(() => setBookmarks([]), [setBookmarks]);

  return {
    bookmarks,
    count: bookmarks.length,
    isBookmarked,
    toggle,
    remove,
    clear,
  };
}
