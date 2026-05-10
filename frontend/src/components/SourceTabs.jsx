const SOURCES = [
  { id: 'all', label: 'All', dot: null },
  { id: 'mercari', label: 'Mercari', dot: 'src-mercari' },
  { id: 'yahoo', label: 'Yahoo Auctions', dot: 'src-yahoo' },
  { id: 'paypay', label: 'PayPay Flea', dot: 'src-paypay' },
];

export function SourceTabs({ active, onChange, counts }) {
  return (
    <div className="source-tabs" role="tablist">
      {SOURCES.map((s) => {
        const n = s.id === 'all'
          ? Object.values(counts || {}).reduce((a, b) => a + b, 0)
          : counts?.[s.id] || 0;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={isActive}
            className={`source-tab ${isActive ? 'active' : ''}`}
            onClick={() => onChange(s.id)}
          >
            {s.dot && <span className={`src-dot ${s.dot}`} />}
            <span>{s.label}</span>
            <span className="source-count">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
