import "./tailwind.css";
import { Hanken_Grotesk, Kufam, Syne } from "next/font/google";
import AppChrome from "@/components/AppChrome";
import AppShell from "@/components/AppShell";
import CookieBar from "@/components/CookieBar";
import TabBar from "@/components/TabBar";
import { Analytics } from "@vercel/analytics/next";
import { createClient } from "@/lib/supabase/server";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${syne.variable} ${hanken.variable} ${kufam.variable}`}>
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


