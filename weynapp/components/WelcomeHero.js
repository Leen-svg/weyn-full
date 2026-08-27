export default function WelcomeHero() {
  return (
    <section className="welcome-hero">
      <div className="welcome-hero__copy">
        <h1>Welcome to Weyn</h1>
        <p className="sub">Curated places across both cities. Save what you like, choose three, then let the group vote.</p>
        <a className="btn primary btn-full" href="/signup">
          Create an account
        </a>
        <a className="btn ghost btn-full" href="/login">
          Log in
        </a>
        <a className="btn ghost btn-full" href="/signup">
          Enter invitation code
        </a>
      </div>
    </section>
  );
}
