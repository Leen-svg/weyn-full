import Link from "next/link";
import EventCard from "@/components/EventCard";
import AttractionCard from "@/components/AttractionCard";

// Both rails self-hide when empty. An empty "What's on" at the top of Home is
// the same defect as the community feed's "No posts yet" — it teaches a new
// user that the product is hollow before they reach anything that works.

export function EventsSection({ events }) {
  if (!events?.length) return null;
  return (
    <section className="app-home__section app-home__events" aria-labelledby="events-title">
      <div className="app-home__section-header">
        <div>
          <h2 id="events-title">What&apos;s on</h2>
          <p>Happening soon, while there&apos;s still time to go.</p>
        </div>
        <Link className="app-home__section-action" href="/events">See all</Link>
      </div>
      <div className="venue-rail" aria-label="Upcoming events">
        {events.map((event) => <EventCard key={event.id} event={event} />)}
      </div>
    </section>
  );
}

export function AttractionsSection({ attractions }) {
  if (!attractions?.length) return null;
  return (
    <section className="app-home__section app-home__attractions" aria-labelledby="attractions-title">
      <div className="app-home__section-header">
        <div>
          <h2 id="attractions-title">Attractions &amp; tickets</h2>
          {/* Affiliate disclosure. Stated once, plainly, next to the rail
              itself rather than buried in a terms page. */}
          <p>
            Booked with our partners. Weyn may earn a commission — it doesn&apos;t change what you pay.
          </p>
        </div>
        <Link className="app-home__section-action" href="/attractions">See all</Link>
      </div>
      <div className="venue-rail" aria-label="Attractions and tickets">
        {attractions.map((a) => <AttractionCard key={a.id} attraction={a} />)}
      </div>
    </section>
  );
}
