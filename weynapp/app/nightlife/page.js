import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession, viewerAccess } from "@/lib/session";
import { getNightlife } from "@/lib/nightlife";
import VenueCard from "@/components/VenueCard";
import VenueActions from "@/components/VenueActions";
import EventCard from "@/components/EventCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "21+ tonight" };

export default async function NightlifePage() {
  const { user } = await currentSession();
  if (!user) redirect("/login?next=%2Fnightlife");

  const access = await viewerAccess();

  // Not old enough, or opted out. Never 404 — that would confirm the section
  // exists to someone it is gated from. Explain and offer the setting.
  if (!access.show21Plus) {
    return (
      <div className="app-home">
        <section className="app-home__section">
          <h1>21+ places</h1>
          <div className="card" style={{ marginTop: 12 }}>
            {access.eligibleFor21Plus ? (
              <>
                <p>You&apos;ve chosen not to see 21+ places and nights.</p>
                <p className="sub" style={{ marginTop: 6 }}>
                  You can turn this on any time from your profile.
                </p>
                <Link className="btn small" style={{ marginTop: 10 }} href="/profile">
                  Open profile settings
                </Link>
              </>
            ) : (
              <>
                <p>This section is for people aged 21 and over.</p>
                <p className="sub" style={{ marginTop: 6 }}>
                  Everything else in Weyn works exactly the same.
                </p>
                <Link className="btn small" style={{ marginTop: 10 }} href="/app">
                  Back to home
                </Link>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  const { rails, events, isEmpty } = await getNightlife(access.allowedAges, { limitPerRail: 24 });

  return (
    <div className="app-home">
      <section className="app-home__intro">
        <header className="app-home__hero">
          <div>
            <h1>21+ tonight</h1>
            <p className="sub">Clubs, bars, beach clubs and the nights that are actually on.</p>
          </div>
        </header>
      </section>

      {isEmpty ? (
        <section className="app-home__section">
          <div className="discover-empty">
            Nothing 21+ is listed yet. We&apos;re filling this in now.
          </div>
        </section>
      ) : (
        <>
          {events.length > 0 && (
            <section className="app-home__section" aria-labelledby="nightlife-events">
              <div className="app-home__section-header">
                <h2 id="nightlife-events">What&apos;s on</h2>
              </div>
              <div className="venue-grid">
                {events.map((event) => <EventCard key={event.id} event={event} />)}
              </div>
            </section>
          )}

          {rails.map((rail) => (
            <section className="app-home__section" key={rail.key} aria-labelledby={`rail-${rail.key}`}>
              <div className="app-home__section-header">
                <div>
                  <h2 id={`rail-${rail.key}`}>{rail.title}</h2>
                  <p>{rail.blurb}</p>
                </div>
              </div>
              <div className="venue-grid">
                {rail.venues.map((v) => (
                  <VenueCard key={v.id} venue={v} variant="discover">
                    <VenueActions venue={v} />
                  </VenueCard>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
