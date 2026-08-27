// Placeholder blocks that hold the shape of the content still loading, so the
// layout does not jump when it arrives.
export function Skeleton({ className = "", style }) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, width = "100%" }) {
  return (
    <span className="skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span
          className="skeleton"
          key={i}
          style={{ width: i === lines - 1 ? "62%" : width, height: 12 }}
        />
      ))}
    </span>
  );
}

// Mirrors the discover-variant venue card: media box, then a footer row.
export function SkeletonVenueCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <span className="skeleton skeleton-card__media" />
      <span className="skeleton-card__body">
        <span className="skeleton" style={{ width: "58%", height: 14 }} />
        <span className="skeleton" style={{ width: "34%", height: 11 }} />
      </span>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="venue-grid" role="status" aria-label="Loading places">
      {Array.from({ length: count }, (_, i) => <SkeletonVenueCard key={i} />)}
    </div>
  );
}
