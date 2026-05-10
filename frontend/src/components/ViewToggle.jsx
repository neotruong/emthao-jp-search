const VIEWS = [
  { id: 'search', label: 'Search' },
  { id: 'image', label: 'Image' },
  { id: 'bookmarks', label: 'Bookmarks' },
];

export function ViewToggle({ active, onChange, bookmarkCount }) {
  return (
    <nav className="view-toggle" role="tablist">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          role="tab"
          aria-selected={active === v.id}
          className={`view-tab ${active === v.id ? 'active' : ''}`}
          onClick={() => onChange(v.id)}
        >
          {v.label}
          {v.id === 'bookmarks' && bookmarkCount > 0 && (
            <span className="badge">{bookmarkCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
