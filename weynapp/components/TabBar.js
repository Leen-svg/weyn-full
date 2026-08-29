"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, House, MessagesSquare, Route, Sparkles, Telescope } from "lucide-react";
import { FEATURES } from "@/lib/features";

// Home is the digest — search, shortcuts, picks.
// Discover is the browse surface: one place at a time, full bleed.
// They are different jobs, so they are different destinations.
//
// Groups is flagged off: it stays reachable by URL and every existing group
// and vote link keeps working, it just isn't primary navigation. A group is a
// closer after a shortlist, not the way in.
const TABS = [
  { href: "/app", label: "Home", Icon: House },
  { href: "/discover", label: "Discover", Icon: Telescope },
  { href: "/find", label: "Find", Icon: Sparkles },
  { href: "/groups", label: "Groups", Icon: MessagesSquare, flag: "groups" },
  { href: "/wishlist", label: "Saved", Icon: Bookmark },
  { href: "/plan", label: "Plan", Icon: Route },
].filter((tab) => !tab.flag || FEATURES[tab.flag]);

export default function TabBar() {
  const pathname = usePathname() || "";

  return (
    <nav className="tabbar" aria-label="App sections">
      {TABS.map(({ href, label, Icon }) => {
        const active =
          pathname === href ||
          pathname.startsWith(`${href}/`) ||
          (href === "/wishlist" && (pathname.startsWith("/lists") || pathname.startsWith("/wishlist"))) ||
          (href === "/groups" && (pathname.startsWith("/vote") || pathname.startsWith("/group"))) ||
          (href === "/discover" && (pathname.startsWith("/gems") || pathname.startsWith("/collections")));
        return (
          <Link
            key={href}
            href={href}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
          >
            <span className="tab-icon" aria-hidden="true">
              <Icon />
            </span>
            <span className="tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
