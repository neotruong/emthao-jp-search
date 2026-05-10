import { useMemo, useState } from 'react';
import { useSearch } from './hooks/useSearch';
import { useBookmarks } from './hooks/useBookmarks';
import { usePersistentState } from './hooks/usePersistentState';
import { useHistory } from './hooks/useHistory';
import { useHealth } from './hooks/useHealth';
import { applyClientFilters } from './lib/filters';
import { SearchBar } from './components/SearchBar';
import { WeightInput } from './components/WeightInput';
import { SourceTabs } from './components/SourceTabs';
import { YahooModeFilter } from './components/YahooModeFilter';
import { SortControls, applySort } from './components/SortControls';
import { ResultCard } from './components/ResultCard';
import { SkeletonCard } from './components/SkeletonCard';
import { BookmarksView } from './components/BookmarksView';
import { ImageSearchTab } from './components/ImageSearchTab';
import { ViewToggle } from './components/ViewToggle';
import { FilterPanel } from './components/FilterPanel';
import { HealthDot } from './components/HealthDot';
import './App.css';

const DEFAULT_PRICING = { rate: 185, markupPct: 20, shipVndPerKg: 175000, defaultWeightKg: 0.2 };
const EMPTY_FILTERS = {
  currency: 'jpy',
  priceMin: null,
  priceMax: null,
  vndMin: null,
  vndMax: null,
  conditionBuckets: [],
};

export default function App() {
  const [view, setView] = useState('search');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [weightKg, setWeightKg] = usePersistentState('emthao.weightKg', 0.2);
  const [cachedPricing] = usePersistentState('emthao.pricing', DEFAULT_PRICING);

  const {
    query,
    yahooMode,
    results,
    pricing: livePricing,
    cached,
    hasMore,
    loading,
    refreshing,
    error,
    search,
    setMode,
    loadMore,
    refresh,
    reset,
  } = useSearch();

  const { bookmarks, count, isBookmarked, toggle, clear } = useBookmarks();
  const { history, push: pushHistory, remove: removeHistory, clear: clearHistory } = useHistory();
  const health = useHealth();

  const goHome = () => {
    setView('search');
    setSourceFilter('all');
    setSortBy('relevance');
    setFilters(EMPTY_FILTERS);
    reset();
  };

  const pricing = livePricing || cachedPricing || DEFAULT_PRICING;

  const onSearch = (q) => {
    if (q) {
      search(q, yahooMode);
      pushHistory({ q, yahooMode });
    } else {
      search('');
    }
  };

  const counts = useMemo(() => {
    const c = { mercari: 0, yahoo: 0, paypay: 0 };
    for (const r of results) if (c[r.source] != null) c[r.source]++;
    return c;
  }, [results]);

  const visible = useMemo(() => {
    const bySource = sourceFilter === 'all' ? results : results.filter((r) => r.source === sourceFilter);
    const filtered = applyClientFilters(bySource, filters, { pricing, weightKg });
    return applySort(filtered, sortBy);
  }, [results, sourceFilter, filters, sortBy, pricing, weightKg]);

  const totalForFilter = sourceFilter === 'all' ? results.length : results.filter((r) => r.source === sourceFilter).length;

  return (
    <div className="app">
      <header className="app-header">
        <button
          type="button"
          className="brand"
          onClick={goHome}
          aria-label="Go to home"
        >
          <h1>EmThao<span className="brand-accent">JP</span></h1>
          <span className="brand-tag">Mercari · Yahoo · PayPay</span>
        </button>
        <div className="header-right">
          <HealthDot
            status={health.status}
            lastChecked={health.lastChecked}
            details={health.details}
            onClick={health.check}
          />
          <ViewToggle active={view} onChange={setView} bookmarkCount={count} />
        </div>
      </header>

      <div className="control-row">
        {view === 'search' && (
          <SearchBar
            value={query}
            onSearch={onSearch}
            onRefresh={refresh}
            loading={loading}
            refreshing={refreshing}
            canRefresh={!!query && !loading}
            history={history}
            onHistoryPick={(q) => onSearch(q)}
            onHistoryRemove={removeHistory}
            onHistoryClear={clearHistory}
          />
        )}
        <WeightInput value={weightKg} onChange={setWeightKg} />
      </div>

      {view === 'search' && (
        <main className="main">
          {error && <div className="error-banner">⚠ {error}</div>}

          {(query || results.length > 0) && (
            <div className="filters-row">
              <SourceTabs active={sourceFilter} onChange={setSourceFilter} counts={counts} />
              {(sourceFilter === 'all' || sourceFilter === 'yahoo') && (
                <YahooModeFilter value={yahooMode} onChange={setMode} />
              )}
              <SortControls value={sortBy} onChange={setSortBy} />
              {cached && !refreshing && <span className="cached-badge">cached</span>}
            </div>
          )}

          {(query || results.length > 0) && (
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
              totalCount={totalForFilter}
              filteredCount={visible.length}
            />
          )}

          {loading && results.length === 0 && (
            <div className="card-grid">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}

          {!loading && results.length > 0 && visible.length === 0 && (
            <div className="empty-state">
              <h2>No matches</h2>
              <p>Adjust the price or condition filters above.</p>
            </div>
          )}

          {!loading && results.length === 0 && query && !error && (
            <div className="empty-state">
              <h2>No results</h2>
              <p>Try a different keyword.</p>
            </div>
          )}

          {visible.length > 0 && (
            <div className="card-grid">
              {visible.map((item) => (
                <ResultCard
                  key={`${item.source}:${item.url}`}
                  item={item}
                  weightKg={weightKg}
                  pricing={pricing}
                  isBookmarked={isBookmarked(item.url)}
                  onToggleBookmark={() => toggle(item)}
                />
              ))}
            </div>
          )}

          {results.length > 0 && hasMore && (
            <div className="load-more-wrap">
              <button
                type="button"
                className="btn btn-secondary load-more"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="empty-state landing">
              <h2>Search 3 Japanese marketplaces at once</h2>
              <p>Mercari, Yahoo Auctions, and PayPay Flea Market — one keyword, JPY + VND prices.</p>
            </div>
          )}
        </main>
      )}

      {view === 'image' && <ImageSearchTab />}

      {view === 'bookmarks' && (
        <BookmarksView
          bookmarks={bookmarks}
          weightKg={weightKg}
          pricing={pricing}
          isBookmarked={isBookmarked}
          onToggleBookmark={toggle}
          onClear={clear}
        />
      )}

      <footer className="app-footer">
        <span>
          Pricing: ¥1 ≈ {pricing.rate} đ · markup {pricing.markupPct}% · shipping{' '}
          {pricing.shipVndPerKg.toLocaleString('vi-VN')} đ/kg
        </span>
      </footer>
    </div>
  );
}
