"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mobile bottom tab bar. The floating pill nav at the top cannot hold the
// section links on a phone without wrapping onto three lines and covering the
// page heading, so on small screens those links live down here instead, in the
// same neo-brutalist idiom as the rest of the site.
const TABS = [
  { href: "/app", label: "Discover", icon: "✦" },
  { href: "/find", label: "Find", icon: "📍" },
  { href: "/groups", label: "Groups", icon: "👥" },
  { href: "/wishlist", label: "Saved", icon: "💭" },
  { href: "/rewards", label: "Points", icon: "🏅" },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link key={t.href} href={t.href} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined}>
            <span className="tab-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="tab-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
