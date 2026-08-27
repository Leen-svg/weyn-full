"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// The tab destinations are roots — there is nothing above them to go back to,
// so the control only appears once you are somewhere deeper.
const ROOTS = new Set(["/app", "/discover", "/find", "/groups", "/wishlist", "/plan"]);

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname() || "";

  if (ROOTS.has(pathname)) return null;

  return (
    <button type="button" aria-label="Back" className="app-chrome-back" onClick={() => router.back()}>
      <ChevronLeft />
    </button>
  );
}
