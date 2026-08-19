const TILTS = [-2, 1.5, -1, 2, -1.5, 1];

export default function TagBadgeList({ tags }) {
  return (
    <div className="favorite-pill-row">
      {tags.map((t, i) => (
        <span
          key={t.slug}
          className={`favorite-pill c${t.category_id % 4}`}
          style={{ "--tilt": `${TILTS[i % TILTS.length]}deg` }}
        >
          {t.display_name}
        </span>
      ))}
    </div>
  );
}
