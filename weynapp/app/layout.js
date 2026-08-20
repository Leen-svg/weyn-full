import "./tailwind.css";
import Link from "next/link";
import { Suspense } from "react";
import AuthNav from "@/components/AuthNav";
import TabBar from "@/components/TabBar";
import PrimaryNav from "@/components/PrimaryNav";
import CookieBar from "@/components/CookieBar";
import { Analytics } from "@vercel/analytics/next";

const TITLE = "Weyn. Where to go tonight, sorted in 30 seconds.";
const DESC =
  "Tap how you're feeling, get three spots, send it to the group, everyone votes. Free, nothing to download, live in Abu Dhabi.";

export const metadata = {
  metadataBase: new URL("https://goweyn.com"),
  title: { default: TITLE, template: "%s · Weyn" },
  description: DESC,
  applicationName: "Weyn",
  keywords: [
    "where to go Abu Dhabi",
    "things to do Abu Dhabi",
    "Abu Dhabi restaurants",
    "group plans",
    "weyn",
    "وين",
  ],
  authors: [{ name: "Weyn" }],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  openGraph: {
    type: "website",
    siteName: "Weyn",
    locale: "en_AE",
    url: "https://goweyn.com/app",
    title: TITLE,
    description: DESC,
    images: [{ url: "/og.png", width: 800, height: 420, alt: "Weyn. Deciding is the worst part of going out. So we handled it." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"] },
  alternates: { canonical: "/app" },
};

export const viewport = {
  themeColor: "#F9F9F9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=Space+Grotesk:wght@400;500;600;700&family=Kufam:wght@400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app-shell">
        <header className="nav">
          <Link href="/app" className="logo">
            weyn<span className="q ar">؟</span>
          </Link>
          <nav className="nav-links">
            <PrimaryNav />
            <Suspense fallback={null}>
              <AuthNav />
            </Suspense>
          </nav>
        </header>
        <main className="container app-main">{children}</main>
        <Suspense fallback={null}>
          <TabBar />
        </Suspense>
        <CookieBar />
        <footer>
          <div className="container">
            <span>
              weyn<span className="q ar">؟</span> · beta · made in Abu Dhabi
            </span>
            <div className="links">
              <a href="/">Home</a>
              <Link href="/submit">Add a spot</Link>
              <Link href="/creators">Creators</Link>
              <Link href="/rate">Rate tags</Link>
              <Link href="/takedown">Video takedown</Link>
            </div>
            <div className="links">
              <a href="https://www.instagram.com/goweynapp" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
              <a href="https://www.tiktok.com/@goweynapp" target="_blank" rel="noopener noreferrer">
                TikTok
              </a>
              <a href="mailto:hello@goweyn.com">hello@goweyn.com</a>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
