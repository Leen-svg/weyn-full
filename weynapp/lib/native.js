"use client";

/**
 * Capacitor bridge for the native shells (ios/, android/).
 *
 * Every export here works on the plain web too: when the app is not running
 * inside a Capacitor WebView, each function falls through to exactly the
 * browser API the site used before this file existed. Nothing in here changes
 * how goweyn.com behaves in a browser.
 *
 * The plugin imports are dynamic and only happen on a native platform, so the
 * web bundle never pays for them.
 */

/** False during SSR and in any browser. Only true inside the iOS/Android shell. */
export function isNative() {
  if (typeof window === "undefined") return false;
  // Capacitor injects this global before any app code runs, so it can be read
  // synchronously without waiting on the dynamic import above.
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

export function nativePlatform() {
  if (typeof window === "undefined") return "server";
  return window.Capacitor?.getPlatform?.() ?? "web";
}

/**
 * Share a link. The Web Share API is unavailable in the iOS WKWebView that
 * Capacitor uses, so on native this goes through the plugin and gets the real
 * system share sheet. On the web it is the same navigator.share call as before,
 * with the same clipboard fallback.
 */
export async function shareLink({ title, url, text }) {
  if (isNative()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text, url, dialogTitle: title });
      return "shared";
    } catch (e) {
      // The user dismissing the sheet rejects too — treat both as "not shared"
      // rather than falling through to a surprise clipboard write.
      return "cancelled";
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  await navigator?.clipboard?.writeText(url);
  return "copied";
}

/**
 * Current position. navigator.geolocation exists inside the WebView but the
 * native permission prompt is only wired up through the plugin, so on native
 * a raw call silently never resolves on a fresh install.
 *
 * Resolves to { lat, lng } or throws, matching what the callers already expect.
 */
export async function getPosition({ timeout = 10000 } = {}) {
  if (isNative()) {
    const { Geolocation } = await import("@capacitor/geolocation");
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== "granted") {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== "granted") throw new Error("Location permission denied");
    }
    const position = await Geolocation.getCurrentPosition({ timeout, enableHighAccuracy: false });
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location is not available on this device");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      reject,
      { timeout, maximumAge: 60000 }
    );
  });
}

/** A short tap on a meaningful action. No-op on the web. */
export async function tapFeedback() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Haptics are a nicety, never a failure worth surfacing.
  }
}

/**
 * Open an external link. In the shell this uses the in-app browser so the user
 * keeps the app rather than being thrown into Safari and losing their place.
 */
export async function openExternal(url) {
  if (isNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url, presentationStyle: "popover" });
      return;
    } catch {
      // fall through to a normal navigation
    }
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}
