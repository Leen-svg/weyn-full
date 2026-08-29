"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ageFromBirthdate } from "@/lib/age";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Three selects rather than <input type="date">: a date picker that opens on
// today is a bad way to enter a birth year, and this keeps the whole step
// tappable on mobile.
export default function AgeOnboarding({ next = "/app" }) {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [wants21, setWants21] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const years = useMemo(() => {
    const now = new Date().getUTCFullYear();
    return Array.from({ length: 90 }, (_, i) => now - 13 - i);
  }, []);

  const daysInMonth = useMemo(() => {
    if (!month || !year) return 31;
    return new Date(Number(year), Number(month), 0).getDate();
  }, [month, year]);

  const birthdate = useMemo(() => {
    if (!day || !month || !year) return null;
    if (Number(day) > daysInMonth) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }, [day, month, year, daysInMonth]);

  const age = birthdate ? ageFromBirthdate(birthdate) : null;
  const eligible = age !== null && age >= 21;

  async function submit(e) {
    e.preventDefault();
    if (!birthdate) {
      setError("Pick your full date of birth.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/age", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthdate, show21Plus: eligible && wants21 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't save that. Try again.");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-kicker">Almost there</div>
      <Card className="onboarding-card">
        <CardHeader>
          <CardTitle>When were you born?</CardTitle>
          <CardDescription>
            Some places in the UAE are 21+ or licensed. We use your date of birth to keep those out of your
            recommendations unless you want them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dob-day">Date of birth</Label>
              <div className="dob-field">
                <select
                  id="dob-day"
                  aria-label="Day"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                >
                  <option value="">Day</option>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
                  <option value="">Month</option>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">Year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground">Private. Never shown on your profile.</p>
            </div>

            {eligible && (
              <label className="toggle-row age-optin">
                <input
                  type="checkbox"
                  checked={wants21}
                  onChange={(e) => setWants21(e.target.checked)}
                />
                <span>
                  <strong>Show me 21+ places and nights</strong>
                  <br />
                  <small>Bars, lounges, clubs, beach clubs and 21+ events. You can change this any time in Profile.</small>
                </span>
              </label>
            )}

            {birthdate && !eligible && age !== null && (
              <div className="notice" role="status">
                We&apos;ll keep licensed and 21+ places out of your recommendations.
              </div>
            )}

            {error && <div className="notice err" role="alert">{error}</div>}

            <Button type="submit" size="lg" className="w-full" disabled={busy || !birthdate}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Continue</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
