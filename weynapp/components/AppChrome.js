import Link from "next/link";
import { Suspense } from "react";
import AuthNav from "@/components/AuthNav";
import BackButton from "@/components/BackButton";

export default function AppChrome() {
  return (
    <header className="app-chrome">
      <BackButton />
      <Link href="/app" className="logo" aria-label="Weyn home">
        weyn
      </Link>
      <div className="app-chrome-right">
        <Suspense fallback={null}>
          <AuthNav />
        </Suspense>
      </div>
    </header>
  );
}
