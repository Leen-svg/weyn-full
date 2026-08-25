"use client";

import { usePathname } from "next/navigation";

const AUTH = ["/login", "/signup", "/forgot-password", "/reset-password", "/auth"];

export default function AppShell({ header, tabs, guest, children }) {
  const path = usePathname() || "";
  const auth = AUTH.some((p) => path === p || path.startsWith(`${p}/`));
  const welcome = guest && (path === "/app" || path === "/");
  const bare = auth || welcome;

  return (
    <div className={bare ? "phone-shell phone-shell--bare" : "phone-shell"}>
      {bare ? null : header}
      <main id="app-content" className="app-main">
        {children}
      </main>
      {bare ? null : tabs}
    </div>
  );
}
