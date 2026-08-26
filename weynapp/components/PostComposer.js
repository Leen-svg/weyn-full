"use client";
import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import useDebounce from "@/hooks/use-debounce";

export default function PostComposer({ onPosted }) {
  const [venueQuery, setVenueQuery] = useState("");
  const debouncedVenueQuery = useDebounce(venueQuery, 300);
  const [venueResults, setVenueResults] = useState([]);
  const [venue, setVenue] = useState(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("");
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (debouncedVenueQuery.trim().length < 2) {
      setVenueResults([]);
      return;
    }
    fetch(`/api/venues/search?q=${encodeURIComponent(debouncedVenueQuery)}`)
      .then((r) => r.json())
      .then((d) => setVenueResults(d.results || []));
  }, [debouncedVenueQuery]);

  async function submit() {
    if (!venue || !body.trim()) return;
    if (!visibility) {
      setErr("Choose Private, Friends, or Public before posting.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      let mediaId = null;
      if (photo) {
        const upload = new FormData();
        upload.set("file", photo);
        upload.set("contextType", "post");
        upload.set("venueId", venue.id);
        upload.set("visibility", visibility);
        const uploadResponse = await fetch("/api/media-upload", { method: "POST", body: upload });
        const uploadBody = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadBody.error || "Couldn't upload that photo");
        mediaId = uploadBody.mediaId;
      }
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, body, visibility, mediaId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't post");

      setVenue(null);
      setVenueQuery("");
      setBody("");
      setPhoto(null);
      setVisibility("");
      onPosted?.(d.pointsEarned);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <Card className="mb-5">
      <CardContent className="space-y-3 pt-6">
        {!venue ? (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Where are you? Search a spot…" value={venueQuery} onChange={(e) => setVenueQuery(e.target.value)} />
            {venueResults.length > 0 && (
                <div className="app-reveal mt-2 space-y-1">
                  {venueResults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="block w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        setVenue(v);
                        setVenueResults([]);
                      }}
                    >
                      <span className="font-medium">{v.name}</span>
                      {v.neighborhood && <span className="text-muted-foreground"> · {v.neighborhood}</span>}
                    </button>
                  ))}
                </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="text-sm font-medium">📍 {venue.name}</span>
              <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setVenue(null)}>
                Change
              </button>
            </div>
            <Textarea placeholder="Why do you recommend it?" value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} />
            <div className="flex items-center gap-2">
              <div className="ml-auto flex flex-wrap gap-1" role="radiogroup" aria-label="Post audience">
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "private"}
                  onClick={() => setVisibility("private")}
                  className={`chip ${visibility === "private" ? "sel" : ""}`}
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  🔒 Private
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "public"}
                  onClick={() => setVisibility("public")}
                  className={`chip ${visibility === "public" ? "sel" : ""}`}
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  🌍 Public
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={visibility === "friends"}
                  onClick={() => setVisibility("friends")}
                  className={`chip ${visibility === "friends" ? "sel" : ""}`}
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  👋 Friends
                </button>
              </div>
            </div>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">{!visibility ? "Choose who can see this post." : visibility === "private" ? "Only you can see this post." : visibility === "friends" ? "Only accepted friends can see this post." : "Anyone can see this post."} Photos stay private until approved.</p>
            {err && <div className="notice err">{err}</div>}
            <Button className="w-full" disabled={busy || !body.trim() || !visibility} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
