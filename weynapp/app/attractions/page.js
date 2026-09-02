import { viewerAccess } from "@/lib/session";
import { getAttractions } from "@/lib/homeRails";
import AttractionCard from "@/components/AttractionCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attractions & tickets" };

export default async function AttractionsPage() {
  const access = await viewerAccess();
  const attractions = await getAttractions(access.allowedAges, { limit: 60 });

  return (
    <div className="app-home">
      <section className="app-home__intro">
        <header className="app-home__hero">
          <div>
            <h1>Attractions &amp; tickets</h1>
          </div>
        </header>
      </section>

      <section className="app-home__section">
        {attractions.length ? (
          <div className="venue-grid">
            {attractions.map((a) => <AttractionCard key={a.id} attraction={a} />)}
          </div>
        ) : (
          <div className="discover-empty">Nothing listed yet. We&apos;re filling this in now.</div>
        )}
      </section>
    </div>
  );
}
