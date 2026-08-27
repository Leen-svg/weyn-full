import "./tailwind.css";
import { Bricolage_Grotesque, Kufam } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import AppShell from "@/components/AppShell";
import CookieBar from "@/components/CookieBar";
import TabBar from "@/components/TabBar";
import { Analytics } from "@vercel/analytics/next";
import { currentSession } from "@/lib/session";

// One family for the whole product. Bricolage Grotesque is variable on both
// weight and optical size, so the same font carries 11px meta rows and 72px
// display headings without needing a second face to pair against.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
  axes: ["opsz"],
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
    // Desktop browser tab: the circular W. Home screen and installed app:
    // the rounded-square wordmark.
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
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
  themeColor: "#F2F2F3",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }) {
  const { user } = await currentSession();

  return (
    <html lang="en" className={`${bricolage.variable} ${kufam.variable}`}>
      <body className="app-shell stitch">
        <a className="skip-link" href="#app-content">
          Skip to content
        </a>
        <AppShell header={<AppChrome />} tabs={<TabBar />} guest={!user}>
          {children}
        </AppShell>
        <CookieBar />
        <Analytics />
      </body>
    </html>
  );
}

