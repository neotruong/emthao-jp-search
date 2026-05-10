export function SkeletonCard() {
  return (
    <article className="card skeleton">
      <div className="card-image-placeholder skeleton-shimmer" />
      <div className="card-body">
        <div className="skeleton-line skeleton-shimmer" style={{ width: '90%' }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '60%' }} />
        <div className="skeleton-line skeleton-shimmer" style={{ width: '40%', marginTop: 12 }} />
      </div>
    </article>
  );
}
