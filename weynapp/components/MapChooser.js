"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, MapPin, X } from "lucide-react";
import styles from "./MapChooser.module.css";

function finiteCoordinate(value, min, max) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function venueDestination(venue) {
  const latitude = finiteCoordinate(venue.latitude, -90, 90);
  const longitude = finiteCoordinate(venue.longitude, -180, 180);
  const label = [venue.name, venue.neighborhood, venue.city || "UAE"]
    .filter(Boolean)
    .join(", ");

  return { latitude, longitude, label };
}

function providerLinks(venue) {
  const { latitude, longitude, label } = venueDestination(venue);
  const query = encodeURIComponent(label);
  const hasCoordinates = latitude !== null && longitude !== null;
  const coordinates = hasCoordinates ? `${latitude},${longitude}` : null;
  const encodedCoordinates = coordinates ? encodeURIComponent(coordinates) : null;

  return [
    {
      name: "Apple Maps",
      detail: "iPhone, iPad and Mac",
      href: hasCoordinates
        ? `https://maps.apple.com/?daddr=${encodedCoordinates}&q=${query}`
        : `https://maps.apple.com/?daddr=${query}`,
    },
    {
      name: "Google Maps",
      detail: "App or browser",
      href: `https://www.google.com/maps/dir/?api=1&destination=${hasCoordinates ? encodedCoordinates : query}`,
    },
    {
      name: "Waze",
      detail: "Live driving directions",
      href: hasCoordinates
        ? `https://waze.com/ul?ll=${encodedCoordinates}&navigate=yes&utm_source=weyn`
        : `https://waze.com/ul?q=${query}&navigate=yes&utm_source=weyn`,
    },
    {
      name: "HERE WeGo",
      detail: "App or browser",
      href: hasCoordinates
        ? `https://wego.here.com/directions/mix//${latitude},${longitude}?to=place.${latitude},${longitude}`
        : `https://wego.here.com/search/${query}`,
    },
    {
      name: "Bing Maps",
      detail: "Browser directions",
      href: hasCoordinates
        ? `https://www.bing.com/maps?rtp=~pos.${latitude}_${longitude}_${query}`
        : `https://www.bing.com/maps?q=${query}`,
    },
    {
      name: "OpenStreetMap",
      detail: "Open map in browser",
      href: hasCoordinates
        ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${encodedCoordinates}`
        : `https://www.openstreetmap.org/search?query=${query}`,
    },
  ];
}

function defaultMapLink(venue, links) {
  const { latitude, longitude, label } = venueDestination(venue);
  if (typeof navigator === "undefined") return links[5].href;

  const agent = navigator.userAgent || "";
  if (/Android/i.test(agent)) {
    const query = encodeURIComponent(
      latitude !== null && longitude !== null
        ? `${latitude},${longitude}(${label})`
        : label,
    );
    return latitude !== null && longitude !== null
      ? `geo:${latitude},${longitude}?q=${query}`
      : `geo:0,0?q=${query}`;
  }
  if (/iPhone|iPad|iPod|Macintosh/i.test(agent)) return links[0].href;
  return links[5].href;
}

export default function MapChooser({ venue, className = "btn small ghost", compact = false }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [defaultHref, setDefaultHref] = useState(null);
  const titleId = useId();
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const links = useMemo(() => providerLinks(venue), [venue]);

  useEffect(() => {
    setDefaultHref(defaultMapLink(venue, links));
  }, [venue, links]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleDialogKeys(event) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sheetRef.current?.querySelectorAll("a[href], button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleDialogKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleDialogKeys);
      triggerRef.current?.focus();
    };
  }, [open]);

  async function copyDestination() {
    const destination = venueDestination(venue).label;
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button ref={triggerRef} className={className} type="button" onClick={() => setOpen(true)}>
        <MapPin aria-hidden="true" size={compact ? 14 : 16} />
        {compact ? "Maps" : "Directions"}
      </button>

      {open && (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section ref={sheetRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className={styles.handle} aria-hidden="true" />
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Get directions</p>
                <h2 id={titleId}>{venue.name}</h2>
                {venue.neighborhood && <p>{venue.neighborhood}</p>}
              </div>
              <button ref={closeButtonRef} className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close map choices">
                <X aria-hidden="true" size={20} />
              </button>
            </header>

            <a className={styles.defaultAction} href={defaultHref || links[5].href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              <span><MapPin aria-hidden="true" size={19} /> Open default maps</span>
              <ExternalLink aria-hidden="true" size={17} />
            </a>

            <div className={styles.providers}>
              {links.map((provider) => (
                <a key={provider.name} href={provider.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                  <span>
                    <strong>{provider.name}</strong>
                    <small>{provider.detail}</small>
                  </span>
                  <ExternalLink aria-hidden="true" size={16} />
                </a>
              ))}
            </div>

            <button className={styles.copy} type="button" onClick={copyDestination}>
              {copied ? <Check aria-hidden="true" size={16} /> : null}
              {copied ? "Address copied" : "Copy place name and address"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

