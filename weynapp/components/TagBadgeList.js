export default function TagBadgeList({ tags }) {
  return (
    <div className="favorite-pill-row">
      {tags.map((t) => (
        <span key={t.slug} className={`favorite-pill c${t.category_id % 4}`}>
          {t.display_name}
        </span>
      ))}
    </div>
  );
}

