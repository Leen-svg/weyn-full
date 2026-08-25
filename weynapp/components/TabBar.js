"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
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
  const reduced = useReducedMotion();

  return (
    <nav className="tabbar" aria-label="App sections">
      {/* LayoutGroup + a shared layoutId is what lets the indigo pill
          travel from the old tab to the new one instead of cutting.
          It is ONE element reparented across tabs, not five elements
          fading, so the movement reads as a single physical object. */}
      <LayoutGroup id="tabbar">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={active ? "tab active lv-press" : "tab lv-press"}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  aria-hidden="true"
                  /* A spring, not a duration: the pill should settle like
                     an object with weight. Tuned to arrive in ~280ms with
                     a barely perceptible overshoot. */
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 520, damping: 38, mass: 0.7 }
                  }
                />
              )}
              <span className="tab-icon" aria-hidden="true"><Icon /></span>
              <span className="tab-label">{label}</span>
            </Link>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
