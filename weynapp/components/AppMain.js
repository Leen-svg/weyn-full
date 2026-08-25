"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* The app's <main>, with two jobs beyond rendering children.

   1. Route transition. The `key` is the pathname, so every
      navigation remounts the element and the CSS enter animation
      replays. This is what makes the app feel like it moves
      between screens instead of repainting.

      Deliberately CSS, not a motion `initial={{opacity:0}}`:
      driving it from JS means the page starts invisible and only
      appears once React has hydrated AND requestAnimationFrame is
      running. A hydration error, a crawler, or a throttled
      background tab would each leave a blank screen. The CSS
      version animates the same way but the content is never
      hidden behind JS succeeding.

   2. Scroll reveal. design-system.css has shipped .fade-up/.in and
      documented an IntersectionObserver contract from the start,
      but nothing ever added the .in class. Wiring the observer up
      here makes .fade-up work anywhere in the app.

   Renders the same <main id="app-content" className="app-main">
   as before. Not a wrapper div: `.app-main > section + section`
   in globals.css needs children to be direct descendants. */
export default function AppMain({ children }) {
  const pathname = usePathname();

  useEffect(() => {
    const targets = document.querySelectorAll(".fade-up:not(.in)");
    if (!targets.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // No observer support, or the user asked for less motion: show
    // everything at once rather than leaving it stuck at opacity 0.
    if (reduced || typeof IntersectionObserver === "undefined") {
      targets.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("in");
          io.unobserve(entry.target); // reveal once, never re-hide
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return (
    <main key={pathname} id="app-content" className="app-main lv-page">
      {children}
    </main>
  );
}
