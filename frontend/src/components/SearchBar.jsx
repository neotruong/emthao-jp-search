import { useState, useEffect, useRef } from 'react';
import { HistoryDropdown } from './HistoryDropdown';

export function SearchBar({
  value,
  onSearch,
  onRefresh,
  loading,
  refreshing,
  history,
  onHistoryPick,
  onHistoryRemove,
  onHistoryClear,
  canRefresh,
}) {
  const [text, setText] = useState(value || '');
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setText(value || '');
  }, [value]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setFocused(false);
    }
    if (focused) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [focused]);

  const submit = () => {
    const q = text.trim();
    if (q) {
      onSearch(q);
      setFocused(false);
    }
  };

  const clear = () => {
    setText('');
    onSearch('');
  };

  const pickFromHistory = (q) => {
    setText(q);
    onHistoryPick?.(q);
  };

  return (
    <div className="search-bar" ref={wrapRef}>
      <div className="search-input-wrap">
        <input
          type="text"
          className="search-input"
          placeholder="Search…  (e.g. iphone 13, handheld fan)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setFocused(false);
          }}
          autoFocus
        />
        {text && (
          <button type="button" className="search-clear" onClick={clear} aria-label="Clear">
            ×
          </button>
        )}
        {focused && (
          <HistoryDropdown
            history={history || []}
            onPick={pickFromHistory}
            onRemove={onHistoryRemove}
            onClear={onHistoryClear}
            onClose={() => setFocused(false)}
          />
        )}
      </div>
      <button
        type="button"
        className="search-submit"
        onClick={submit}
        disabled={loading || !text.trim()}
      >
        {loading ? '…' : 'Search'}
      </button>
      <button
        type="button"
        className={`search-refresh ${refreshing ? 'spinning' : ''}`}
        onClick={onRefresh}
        disabled={!canRefresh || refreshing}
        title="Refresh — bypass server cache and re-scrape"
        aria-label="Refresh"
      >
        ↻
      </button>
    </div>
  );
}
