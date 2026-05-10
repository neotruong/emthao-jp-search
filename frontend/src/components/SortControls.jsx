const OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'newest', label: 'Newest update' },
  { id: 'price-asc', label: 'Price ↑' },
  { id: 'price-desc', label: 'Price ↓' },
  { id: 'saved-desc', label: 'Newest saved', bookmarksOnly: true },
];

export function SortControls({ value, onChange, isBookmarksView = false }) {
  const visible = OPTIONS.filter((o) => isBookmarksView || !o.bookmarksOnly);
  return (
    <div className="sort-controls">
      <label className="sort-label">Sort by</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="sort-select">
        {visible.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function applySort(items, sortBy) {
  const copy = [...items];
  switch (sortBy) {
    case 'price-asc':
      return copy.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    case 'price-desc':
      return copy.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    case 'newest':
      // Items without updatedAt sort to the end (Yahoo and PayPay don't expose post time yet).
      return copy.sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : -Infinity;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : -Infinity;
        return tb - ta;
      });
    case 'saved-desc':
      return copy.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
    case 'relevance':
    default:
      return copy;
  }
}
