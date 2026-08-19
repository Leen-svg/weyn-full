import Link from "next/link";

export const metadata = {
  title: "Can't find that one. Weyn.",
  description: "That page doesn't exist. Head back to Weyn and find somewhere to go instead.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(90px,22vw,170px)",
          lineHeight: 0.85,
          letterSpacing: "-6px",
          color: "var(--pink)",
          marginBottom: 8,
        }}
      >
        404
      </div>
      <h1>
        We can&apos;t find that one. <span className="ar" lang="ar">وين؟</span>
      </h1>
      <p className="sub">
        The page you&apos;re after doesn&apos;t exist, or it moved. Either way you&apos;re still standing outside with
        nowhere to go, so let&apos;s fix that instead.
      </p>
      <div className="cta-row">
        <Link className="btn primary" href="/find">
          Find me a spot
        </Link>
        <Link className="btn" href="/app">
          Back to Discover
        </Link>
      </div>
      <p className="sub" style={{ marginTop: 28 }}>
        Think this is our fault? Probably is. Email <a href="mailto:hello@goweyn.com"><b>hello@goweyn.com</b></a> and
        we&apos;ll sort it.
      </p>
    </>
  );
}
