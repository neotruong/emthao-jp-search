import { useCallback, useRef, useState } from 'react';
import { searchAll } from '../api/search';

const PAGE_SIZE = 20;

export function useSearch() {
  const [query, setQuery] = useState('');
  const [yahooMode, setYahooMode] = useState('all');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);   // accumulated across pages
  const [pricing, setPricing] = useState(null);
  const [cached, setCached] = useState(false);
  const [hasMore, setHasMore] = useState(true); // last page returned items?
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const inflightRef = useRef(null);

  const fetchPage = useCallback(
    async ({ q, yahooMode: ym, pageToFetch, append, nocache }) => {
      if (!q || !q.trim()) {
        setQuery('');
        setResults([]);
        setError(null);
        setHasMore(true);
        return;
      }
      if (inflightRef.current) inflightRef.current.abort();
      const ac = new AbortController();
      inflightRef.current = ac;

      if (nocache) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await searchAll({
          q: q.trim(),
          yahooMode: ym,
          limit: PAGE_SIZE,
          page: pageToFetch,
          nocache,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;

        const incoming = res?.results || [];
        // dedupe across pages (in case backend duplicates, defensive)
        if (append) {
          setResults((prev) => {
            const seen = new Set(prev.map((r) => r.url));
            return [...prev, ...incoming.filter((r) => r.url && !seen.has(r.url))];
          });
        } else {
          setResults(incoming);
        }
        setQuery(q);
        setYahooMode(ym);
        setPage(pageToFetch);
        setPricing(res?.pricing || null);
        setCached(!!res?.cached);
        setHasMore(incoming.length >= PAGE_SIZE / 2); // heuristic: if returned half-page+ assume more

        if (res?.pricing) {
          try {
            localStorage.setItem('emthao.pricing', JSON.stringify(res.pricing));
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Search failed');
        if (!append) setResults([]);
      } finally {
        if (inflightRef.current === ac) {
          setLoading(false);
          setRefreshing(false);
          inflightRef.current = null;
        }
      }
    },
    []
  );

  const search = useCallback(
    (q, ym = 'all') => fetchPage({ q, yahooMode: ym, pageToFetch: 1, append: false }),
    [fetchPage]
  );

  const setMode = useCallback(
    (ym) => {
      if (query) fetchPage({ q: query, yahooMode: ym, pageToFetch: 1, append: false });
      else setYahooMode(ym);
    },
    [fetchPage, query]
  );

  const loadMore = useCallback(
    () => fetchPage({ q: query, yahooMode, pageToFetch: page + 1, append: true }),
    [fetchPage, query, yahooMode, page]
  );

  const refresh = useCallback(
    () => fetchPage({ q: query, yahooMode, pageToFetch: 1, append: false, nocache: true }),
    [fetchPage, query, yahooMode]
  );

  const cancel = useCallback(() => {
    inflightRef.current?.abort();
    inflightRef.current = null;
    setLoading(false);
    setRefreshing(false);
  }, []);

  const reset = useCallback(() => {
    inflightRef.current?.abort();
    inflightRef.current = null;
    setQuery('');
    setYahooMode('all');
    setPage(1);
    setResults([]);
    setCached(false);
    setHasMore(true);
    setLoading(false);
    setRefreshing(false);
    setError(null);
  }, []);

  return {
    query,
    yahooMode,
    page,
    results,
    pricing,
    cached,
    hasMore,
    loading,
    refreshing,
    error,
    search,
    setMode,
    loadMore,
    refresh,
    cancel,
    reset,
  };
}
