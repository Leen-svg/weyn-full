export default function WelcomeHero() {
  return (
    <section className="welcome-hero">
      <div className="welcome-hero__copy">
        <p className="eyebrow">Abu Dhabi · Dubai</p>
        <h1>
          Welcome
          <br />
          to Weyn
        </h1>
        <p className="sub">Your private circle for the best spots. Three options, then the group votes.</p>
        <a className="btn primary block" href="/signup">
          Sign up
        </a>
        <a className="btn ghost block" href="/login">
          Log in
        </a>
      </div>
    </section>
  );
}
