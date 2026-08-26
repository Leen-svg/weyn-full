"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { oneTapMapHref } from "@/lib/map-links.mjs";

/* One map button.

   This used to open a sheet listing seven providers. Choosing a maps app is a
   decision people make once, when they install one, so the sheet asked it
   again on every venue. Now a single tap goes straight there: Android gets its
   own app chooser via a geo: URI, iOS gets Apple Maps, laptops get Google Maps.

   The href is resolved after mount because it depends on the user agent, and
   rendering it on the server would send every visitor the desktop link. */
export default function MapChooser({ venue, className = "btn small ghost", compact = false }) {
  const [href, setHref] = useState(() => oneTapMapHref(venue));

  useEffect(() => {
    setHref(oneTapMapHref(venue, navigator.userAgent));
  }, [venue]);

  const isAppLink = href.startsWith("geo:") || href.startsWith("maps://");

  return (
    <a
      className={className}
      href={href}
      // geo:/maps:// hand off to a native app, where a new tab would be left
      // behind blank. Web links still open away from the app.
      target={isAppLink ? undefined : "_blank"}
      rel={isAppLink ? undefined : "noopener noreferrer"}
      aria-label={`Open ${venue?.name || "this place"} in maps`}
    >
      <MapPin aria-hidden="true" size={compact ? 14 : 16} />
      {compact ? "Maps" : "Directions"}
    </a>
  );
}
