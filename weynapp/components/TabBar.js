"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, MapPinned, MessagesSquare, Route } from "lucide-react";

const TABS = [
  { href: "/app", label: "Discover", Icon: Compass },
  { href: "/find", label: "Find", Icon: MapPinned },
  { href: "/groups", label: "Groups", Icon: MessagesSquare },
  { href: "/wishlist", label: "Saved", Icon: Bookmark },
  { href: "/plan", label: "Plan", Icon: Route },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="App sections">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link key={href} href={href} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined}>
            <span className="tab-icon" aria-hidden="true"><Icon /></span>
            <span className="tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
