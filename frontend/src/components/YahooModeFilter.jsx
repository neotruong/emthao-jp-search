const MODES = [
  { id: 'all', label: 'All' },
  { id: 'auction', label: 'Auction' },
  { id: 'fixed', label: 'Buy Now' },
];

export function YahooModeFilter({ value, onChange }) {
  return (
    <div className="yahoo-modes" role="tablist" aria-label="Yahoo mode filter">
      {MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={value === m.id}
          className={`yahoo-mode ${value === m.id ? 'active' : ''}`}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
