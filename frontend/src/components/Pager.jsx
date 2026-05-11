export function Pager({ currentPage, loadedPages, onSelect, onLoadNext, exhausted, loading }) {
  if (loadedPages === 0) return null;
  const pages = Array.from({ length: loadedPages }, (_, i) => i + 1);
  return (
    <nav className="pager" aria-label="Pagination">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`pager-page ${currentPage === p ? 'active' : ''}`}
          aria-current={currentPage === p ? 'page' : undefined}
          onClick={() => onSelect(p)}
          disabled={loading}
        >
          {p}
        </button>
      ))}
      {!exhausted && (
        <button
          type="button"
          className="pager-next"
          onClick={onLoadNext}
          disabled={loading}
          aria-label="Load next page"
          title="Load next page"
        >
          {loading ? '…' : '+'}
        </button>
      )}
    </nav>
  );
}
