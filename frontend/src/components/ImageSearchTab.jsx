export function ImageSearchTab() {
  return (
    <div className="empty-state image-search-placeholder">
      <h2>Image search</h2>
      <p>Coming in Phase 3 — upload a photo and find visually similar listings across all 3 markets.</p>
      <div className="dropzone" aria-disabled="true">
        Drop an image here (disabled)
      </div>
    </div>
  );
}
