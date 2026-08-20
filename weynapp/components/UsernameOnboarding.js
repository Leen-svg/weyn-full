"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UsernameOnboarding({ next = "/app" }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const value = username.trim().toLowerCase();
    setError(null);

    if (!/^[a-z0-9_]{3,24}$/.test(value)) {
      setError("Use 3–24 letters, numbers, or underscores.");
      return;
    }

    setBusy(true);
    try {
      const availabilityRes = await fetch(`/api/profile/username?username=${encodeURIComponent(value)}`);
      const availability = await availabilityRes.json();
      if (!availabilityRes.ok || !availability.available) {
        throw new Error(availability.error || "That username is already taken.");
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(next)}`)}`);
        return;
      }

      const { error: saveError } = await supabase
        .from("profile_public")
        .update({ display_name: value })
        .eq("id", user.id);
      if (saveError?.code === "23505") throw new Error("That username is already taken.");
      if (saveError) throw saveError;

      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err.message || "Couldn't save that username. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-kicker">One last thing</div>
      <Card className="onboarding-card">
        <CardHeader>
          <CardTitle>Choose your username</CardTitle>
          <CardDescription>This is what friends, groups, reviews, and votes will see—never your email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="onboarding-username">Username</Label>
              <div className="username-field">
                <span aria-hidden="true">@</span>
                <Input
                  id="onboarding-username"
                  autoFocus
                  autoComplete="username"
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_username"
                />
              </div>
              <p className="text-xs text-muted-foreground">Unique, public, and editable later in Profile.</p>
            </div>

            {error && <div className="notice err" role="alert">{error}</div>}

            <Button type="submit" size="lg" className="w-full" disabled={busy || username.length < 3}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Continue</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

