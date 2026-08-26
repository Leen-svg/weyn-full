"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";

const AUTH = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth"];

export default function AppShell({ header, tabs, guest, children }) {
  const path = usePathname() || "";
  const auth = AUTH.some((p) => path === p || path.startsWith(`${p}/`));
  const welcome = guest && (path === "/app" || path === "/");
  const bare = auth || welcome;

  return (
    <div className={bare ? "phone-shell phone-shell--bare" : "phone-shell"}>
      {/* Auth screens drop the full app chrome, but still need a brand anchor
          and a way back out — without one they read as an unbranded form. */}
      {auth ? (
        <div className="auth-topbar">
          <Link href="/app" className="logo" aria-label="Weyn home">
            weyn
          </Link>
          <Link href="/app" className="auth-topbar__back">
            <ArrowLeft aria-hidden="true" />
            Back to Weyn
          </Link>
        </div>
      ) : null}
      {bare ? null : header}
      <main id="app-content" className="app-main">
        {children}
      </main>
      {bare ? null : tabs}
    </div>
  );
}
