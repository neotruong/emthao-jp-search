function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function HistoryDropdown({ history, onPick, onRemove, onClear, onClose }) {
  if (!history.length) {
    return (
      <div className="history-dropdown empty">
        <span className="history-empty-text">No recent searches</span>
      </div>
    );
  }

  return (
    <div className="history-dropdown">
      <div className="history-header">
        <span>Recent searches</span>
        <button
          type="button"
          className="history-clear-link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onClear();
            onClose?.();
          }}
        >
          Clear all
        </button>
      </div>
      <ul className="history-list">
        {history.map((h) => (
          <li key={h.q} className="history-item">
            <button
              type="button"
              className="history-pick"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(h.q);
                onClose?.();
              }}
            >
              <span className="history-icon" aria-hidden="true">↻</span>
              <span className="history-q">{h.q}</span>
              <span className="history-time">{timeAgo(h.ts)}</span>
            </button>
            <button
              type="button"
              className="history-remove"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRemove(h.q)}
              aria-label={`Remove ${h.q}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
