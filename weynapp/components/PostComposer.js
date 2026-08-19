"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Image as ImageIcon, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import useDebounce from "@/hooks/use-debounce";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function PostComposer({ onPosted }) {
  const [venueQuery, setVenueQuery] = useState("");
  const debouncedVenueQuery = useDebounce(venueQuery, 300);
  const [venueResults, setVenueResults] = useState([]);
  const [venue, setVenue] = useState(null);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
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

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setErr("Photos only, JPG, PNG, WEBP or GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setErr("That photo's too big, 5MB max.");
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function submit() {
    if (!venue || !body.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      let photoUrl = null;
      if (photoFile) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const ext = photoFile.name.split(".").pop();
        const path = `${user.id}/post-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("review-photos").upload(path, photoFile, { contentType: photoFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("review-photos").getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: venue.id, body, visibility, photoUrl }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't post");

      setVenue(null);
      setVenueQuery("");
      setBody("");
      setPhotoFile(null);
      setPhotoPreview(null);
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
            <AnimatePresence>
              {venueResults.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 space-y-1">
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
                </motion.div>
              )}
            </AnimatePresence>
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
              {photoPreview && <img src={photoPreview} alt="" className="h-10 w-10 rounded object-cover" style={{ border: "2px solid var(--ink)" }} />}
              <label className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                <ImageIcon className="h-4 w-4" /> Photo
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={pickPhoto} className="hidden" />
              </label>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => setVisibility("public")}
                  className={`chip ${visibility === "public" ? "sel" : ""}`}
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  🌍 Public
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility("friends")}
                  className={`chip ${visibility === "friends" ? "sel" : ""}`}
                  style={{ padding: "4px 10px", fontSize: 11 }}
                >
                  👋 Friends
                </button>
              </div>
            </div>
            {err && <div className="notice err">{err}</div>}
            <Button className="w-full" disabled={busy || !body.trim()} onClick={submit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
