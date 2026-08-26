"use client";

export default function Error({ reset }) {
  return (
    <>
      <span className="kick">Something broke</span>
      <h1>
        That&apos;s on us. <span className="ar" lang="ar">وين؟</span>
      </h1>
      <p className="sub">
        This page didn&apos;t load. Try again in a second, and if it keeps happening email{" "}
        <a href="mailto:hello@goweyn.com">
          <b>hello@goweyn.com</b>
        </a>{" "}
        and we&apos;ll fix it fast.
      </p>
      <div className="cta-row">
        <button className="btn primary" onClick={() => reset()}>
          Try again
        </button>
        <a className="btn" href="/">
          Back to the site
        </a>
      </div>
    </>
  );
}

