"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, MapPin, X } from "lucide-react";
import { preferredMapHref, providerLinks, venueDestination } from "@/lib/map-links.mjs";
import styles from "./MapChooser.module.css";

export default function MapChooser({ venue, className = "btn small ghost", compact = false }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const titleId = useId();
  const triggerRef = useRef(null);
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const links = useMemo(() => providerLinks(venue), [venue]);

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

            <a
              className={styles.defaultAction}
              href={preferredMapHref(venue)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                event.currentTarget.href = preferredMapHref(venue, navigator.userAgent);
                window.setTimeout(() => setOpen(false), 0);
              }}
            >
              <span><MapPin aria-hidden="true" size={19} /> Open default maps</span>
              <ExternalLink aria-hidden="true" size={17} />
            </a>

            <div className={styles.providers}>
              {links.map((provider) => (
                <a key={provider.name} href={provider.href} target="_blank" rel="noopener noreferrer" onClick={() => window.setTimeout(() => setOpen(false), 0)}>
                  <span className={`${styles.providerMark} ${styles[`providerMark_${provider.id}`]}`} aria-hidden="true">{provider.mark}</span>
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
