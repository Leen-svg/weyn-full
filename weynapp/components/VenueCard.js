import { safeUrl } from "@/lib/sanitize";

const PLACEHOLDER_GRADIENTS = [
  "linear-gradient(135deg, var(--purple-wash), var(--sky-wash))",
  "linear-gradient(135deg, var(--pink-wash), var(--yellow-wash))",
  "linear-gradient(135deg, var(--sky-wash), var(--yellow-wash))",
];

function gradientFor(id) {
  let hash = 0;
  for (const ch of id || "") hash = (hash + ch.charCodeAt(0)) % PLACEHOLDER_GRADIENTS.length;
  return PLACEHOLDER_GRADIENTS[hash];
}

export default function VenueCard({ venue, children, picked }) {
  const spend = venue.avg_spend_aed === 0 ? "Free entry" : `~${venue.avg_spend_aed} AED pp`;
  const ageLabel = venue.age_restriction === "21-plus" ? "21+" : venue.age_restriction === "18-plus" ? "18+" : null;
  const videoUrl = safeUrl(venue.hero_video_url);
  const mapsUrl = safeUrl(venue.google_maps_url);
  const coverUrl = safeUrl(venue.cover_url);

  return (
    <div className={`venue-card${picked ? " picked" : ""}`}>
      <div className="venue-cover" style={coverUrl ? undefined : { background: gradientFor(venue.id) }}>
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <span className="venue-cover-glyph">📍</span>}
        {venue.city === "Dubai" && <span className="venue-city-badge">Dubai</span>}
      </div>
      <div className="venue-card-body">
        <div className="venue-name">{venue.name}</div>
        <div className="venue-meta">
          {venue.neighborhood} · {spend}
          {venue.is_aesthetic ? " · 📸 aesthetic" : ""}
          {ageLabel ? ` · 🔞 ${ageLabel}` : ""}
        </div>
        {venue.description && <p className="venue-desc">{venue.description}</p>}
        {venue.tags && (
          <div className="tag-row">
            {venue.tags.map((t) => <span key={t} className="tag-pill">{t}</span>)}
          </div>
        )}
        <div className="venue-links">
          {videoUrl && (
            <a className="btn small ghost" href={videoUrl} target="_blank" rel="noreferrer">
              ▶ Watch
            </a>
          )}
          {mapsUrl && (
            <a className="btn small ghost" href={mapsUrl} target="_blank" rel="noreferrer">
              📍 Maps
            </a>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
