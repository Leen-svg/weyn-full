"use client";
import { track } from "@vercel/analytics";

export function trackProductEvent(name, properties = {}) {
  try {
    const clean = Object.fromEntries(Object.entries(properties).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).slice(0, 12));
    track(name, clean);
  } catch {
    // Analytics must never interrupt the user action being measured.
  }
}
