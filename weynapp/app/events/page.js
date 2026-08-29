import { viewerAccess } from "@/lib/session";
import { getUpcomingEvents } from "@/lib/homeRails";
import EventCard from "@/components/EventCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "What's on" };

export default async function EventsPage() {
  const access = await viewerAccess();
  const events = await getUpcomingEvents(access.allowedAges, { limit: 60 });

  return (
    <div className="app-home">
      <section className="app-home__intro">
        <header className="app-home__hero">
          <div>
            <h1>What&apos;s on</h1>
            <p className="sub">Everything coming up that you can still get to.</p>
          </div>
        </header>
      </section>

      <section className="app-home__section">
        {events.length ? (
          <div className="venue-grid">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="discover-empty">Nothing listed yet. We&apos;re filling this in now.</div>
        )}
      </section>
    </div>
  );
}
