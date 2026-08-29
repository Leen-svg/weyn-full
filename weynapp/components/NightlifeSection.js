import Link from "next/link";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import EventCard from "@/components/EventCard";

// Rendered only for viewers whose age tier is 21-plus. The caller decides
// that; this component never re-derives eligibility.
export default function NightlifeSection({ rails, events, isEmpty }) {
  return (
    <section className="app-home__section app-home__nightlife" aria-labelledby="nightlife-title">
      <div className="app-home__section-header">
        <div>
          <h2 id="nightlife-title">21+ tonight</h2>
          <p>Clubs, bars, beach clubs and the nights that are actually on.</p>
        </div>
        <Link className="app-home__section-action" href="/nightlife">See all</Link>
      </div>

      {isEmpty ? (
        <div className="discover-empty">
          We&apos;re still filling this in. Nothing 21+ is listed yet.
        </div>
      ) : (
        <>
          {events.length > 0 && (
            <div className="nightlife-block">
              <h3 className="nightlife-block__title">What&apos;s on</h3>
              <div className="venue-rail" aria-label="Upcoming 21+ nights">
                {events.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            </div>
          )}

          {rails.map((rail) => (
            <div className="nightlife-block" key={rail.key}>
              <h3 className="nightlife-block__title">{rail.title}</h3>
              <p className="nightlife-block__blurb">{rail.blurb}</p>
              <div className="venue-rail" aria-label={rail.title}>
                {rail.venues.map((v) => (
                  <VenueCard key={v.id} venue={v} variant="discover">
                    <VenueActions venue={v} />
                  </VenueCard>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
