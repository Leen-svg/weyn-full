"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNative } from "@/lib/native";

/**
 * Native-only shell behaviour for the iOS/Android Capacitor builds.
 *
 * Renders nothing and does nothing at all in a browser: every effect below is
 * behind isNative(), so goweyn.com is byte-identical with this mounted.
 */
export default function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;
    const listeners = [];

    async function setup() {
      // --- status bar: match the paper background, dark glyphs ---
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Light }); // Light = dark text
        // setBackgroundColor is Android-only; it throws on iOS, hence its own try.
        try {
          await StatusBar.setBackgroundColor({ color: "#F9F9F9" });
        } catch {}
      } catch {}

      // --- splash: hold it until the first paint, then drop it ---
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide();
      } catch {}

      // --- Android hardware back button ---
      // Without this, back exits the app from any screen, which reviewers
      // flag and users hate. Walk history instead, and only exit at the root.
      try {
        const { App } = await import("@capacitor/app");
        const back = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else App.exitApp();
        });
        listeners.push(back);

        // --- deep links: goweyn.com/p/<code> vote links open in the app ---
        const openUrl = await App.addListener("appUrlOpen", ({ url }) => {
          try {
            const parsed = new URL(url);
            if (parsed.origin.includes("goweyn.com")) {
              router.push(parsed.pathname + parsed.search);
            }
          } catch {
            // A malformed URL from the OS is not worth crashing over.
          }
        });
        listeners.push(openUrl);
      } catch {}
    }

    setup();

    return () => {
      listeners.forEach((listener) => listener?.remove?.());
    };
  }, [router]);

  return null;
}
