"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/app", label: "Discover" },
  { href: "/find", label: "Find" },
  { href: "/groups", label: "Groups" },
  { href: "/wishlist", label: "Saved" },
  { href: "/plan", label: "Plan" },
];

export default function PrimaryNav() {
  const pathname = usePathname();

  return (
    <div className="primary-nav" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "nav-section active" : "nav-section"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

