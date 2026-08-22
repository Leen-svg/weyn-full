import "./tailwind.css";
import Link from "next/link";
import { Suspense } from "react";
import { Bricolage_Grotesque, Kufam, Space_Grotesk } from "next/font/google";
import AuthNav from "@/components/AuthNav";
import TabBar from "@/components/TabBar";
import PrimaryNav from "@/components/PrimaryNav";
import CookieBar from "@/components/CookieBar";
import { Analytics } from "@vercel/analytics/next";
import InvitationGate from "@/components/InvitationGate";
import { hasBetaAccess } from "@/lib/beta-access";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});
const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});
const kufam = Kufam({
  subsets: ["arabic", "latin"],
  variable: "--font-kufam",
  display: "swap",
});

const TITLE = "Weyn App — Find your next spot in 30 seconds";
const DESC =
  "Pick the mood and budget, discover curated UAE spots, then send them to the group for a quick vote.";

export const metadata = {
  metadataBase: new URL("https://www.goweyn.com"),
  title: { default: TITLE, template: "%s · Weyn" },
  description: DESC,
  applicationName: "Weyn",
  category: "lifestyle",
  keywords: [
    "where to go UAE",
    "things to do Dubai",
    "Abu Dhabi restaurants",
    "Dubai restaurants",
    "group plans",
    "weyn",
    "وين",
  ],
  authors: [{ name: "Weyn", url: "https://goweyn.com" }],
  creator: "Weyn",
  publisher: "Weyn",
  manifest: "/manifest.webmanifest",
  formatDetection: { email: false, address: false, telephone: false },
  robots: { index: false, follow: false, nocache: true },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Weyn",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Weyn",
    locale: "en_AE",
    url: "https://www.goweyn.com/app",
    title: TITLE,
    description: DESC,
    images: [{ url: "/og.png", width: 800, height: 420, alt: "Weyn — bringing the social back to going out." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: ["/og.png"] },
};

export const viewport = {
  themeColor: "#F9F9F9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  const betaAccess = await hasBetaAccess();
  return (
    <html lang="en">
      <body className={`app-shell ${bricolage.variable} ${space.variable} ${kufam.variable}`}>
        {!betaAccess && <InvitationGate />}
        <a className="skip-link" href="#app-content">Skip to content</a>
        <header className="nav">
          <Link href="/app" className="logo" aria-label="Weyn home">
            weyn<span className="q ar">؟</span>
          </Link>
          <nav className="nav-links" aria-label="Main navigation">
            <PrimaryNav />
            <Suspense fallback={null}>
              <AuthNav />
            </Suspense>
          </nav>
        </header>
        <main id="app-content" className="app-main">{children}</main>
        <Suspense fallback={null}>
          <TabBar />
        </Suspense>
        <CookieBar />
        <footer>
          <div className="container">
            <span>
              weyn<span className="q ar">؟</span> · beta · made in the UAE
            </span>
            <div className="links">
              <a href="/terms">Terms</a>
              <a href="/privacy">Privacy</a>
              <a href="/">Home</a>
              <Link href="/submit">Add a spot</Link>
              <Link href="/creators">Creators</Link>
              <Link href="/rate">Rate tags</Link>
              <Link href="/takedown">Video takedown</Link>
            </div>
            <div className="links">
              <a href="https://www.instagram.com/goweynapp" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://www.tiktok.com/@goweynapp" target="_blank" rel="noopener noreferrer">TikTok</a>
              <a href="mailto:hello@goweyn.com">hello@goweyn.com</a>
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}


