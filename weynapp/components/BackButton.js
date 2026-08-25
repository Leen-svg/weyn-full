"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button type="button" aria-label="Back" className="app-chrome-back" onClick={() => router.back()}>
      <ChevronLeft />
    </button>
  );
}
