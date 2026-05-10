import { useMemo, useState } from 'react';
import { ResultCard } from './ResultCard';
import { SourceTabs } from './SourceTabs';
import { SortControls, applySort } from './SortControls';

export function BookmarksView({ bookmarks, weightKg, pricing, isBookmarked, onToggleBookmark, onClear }) {
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('saved-desc');

  const counts = useMemo(() => {
    const c = { mercari: 0, yahoo: 0, paypay: 0 };
    for (const b of bookmarks) if (c[b.source] != null) c[b.source]++;
    return c;
  }, [bookmarks]);

  const filtered = useMemo(() => {
    const base = sourceFilter === 'all' ? bookmarks : bookmarks.filter((b) => b.source === sourceFilter);
    return applySort(base, sortBy);
  }, [bookmarks, sourceFilter, sortBy]);

  if (bookmarks.length === 0) {
    return (
      <div className="empty-state">
        <h2>No bookmarks yet</h2>
        <p>Tap the heart on any result to save it here.</p>
      </div>
    );
  }

  return (
    <div className="bookmarks-view">
      <div className="bookmarks-header">
        <SourceTabs active={sourceFilter} onChange={setSourceFilter} counts={counts} />
        <div className="bookmarks-actions">
          <SortControls value={sortBy} onChange={setSortBy} isBookmarksView />
          <button className="btn btn-ghost" onClick={onClear} title="Remove all bookmarks">
            Clear all
          </button>
        </div>
      </div>

      <div className="card-grid">
        {filtered.map((item) => (
          <ResultCard
            key={item.url}
            item={item}
            weightKg={weightKg}
            pricing={pricing}
            isBookmarked={isBookmarked(item.url)}
            onToggleBookmark={() => onToggleBookmark(item)}
          />
        ))}
      </div>
    </div>
  );
}
