"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function ProfileForm({ initial, email, groups }) {
  const [displayName, setDisplayName] = useState(initial.display_name || "");
  const [bio, setBio] = useState(initial.bio || "");
  const [favoriteTags, setFavoriteTags] = useState(initial.favorite_tags || []);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url || "");
  const [shareActivity, setShareActivity] = useState(!!initial.share_activity_with_friends);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const fileInputRef = useRef(null);

  function toggleTag(slug) {
    setFavoriteTags((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setErr("Photos only, JPG, PNG, WEBP or GIF.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErr("That photo's too big, 5MB max.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${pub.publicUrl}?t=${Date.now()}`);
    } catch (e2) {
      setErr(e2.message);
    }
    setUploading(false);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profile_public")
      .update({
        display_name: displayName.trim().slice(0, 40) || null,
        bio: bio.trim().slice(0, 300) || null,
        favorite_tags: favoriteTags,
        avatar_url: avatarUrl || null,
        share_activity_with_friends: shareActivity,
      })
      .eq("id", user.id);
    if (error) setErr(error.message);
    else setMsg("Saved.");
    setBusy(false);
  }

  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  return (
    <form onSubmit={save} className="space-y-5">
      <Card>
        <CardContent className="flex items-center gap-5 pt-6">
          <div className="relative">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => fileInputRef.current?.click()}
              className="relative block h-20 w-20 overflow-hidden rounded-full border-2"
              style={{ borderColor: "var(--ink)" }}
            >
              <Avatar className="h-20 w-20">
                <AvatarImage src={safeUrl(avatarUrl)} alt="" />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity hover:bg-black/40 hover:opacity-100">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
              </div>
            </motion.button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} className="hidden" />
          </div>
          <div>
            <div className="font-semibold" style={{ fontFamily: "var(--font-display)" }}>{displayName || "Your name"}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-1 text-xs font-semibold text-primary hover:underline">
              Change photo
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>Shown on reviews and to friends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input id="display-name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className="text-xs text-muted-foreground">{bio.length}/300</span>
            </div>
            <Textarea id="bio" maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line about you…" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favorite vibes</CardTitle>
          <CardDescription>Shown on your public profile. Helps power your weekly picks later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {favoriteTags.length > 0 && (
            <div className="rounded-lg border p-3">
              <div className="mb-2 text-xs font-semibold text-muted-foreground">Your picks</div>
              <div className="flex flex-wrap gap-2">
                {favoriteTags.map((slug) => {
                  const t = groups.flatMap((g) => g.tags).find((x) => x.slug === slug);
                  if (!t) return null;
                  return (
                    <Badge key={slug} onClick={() => toggleTag(slug)} variant="default" className="cursor-pointer select-none px-3 py-1.5 text-sm">
                      <Check className="mr-1 h-3 w-3" />
                      {t.display_name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          <Accordion type="multiple" className="w-full">
            {groups.map((cat) => (
              <AccordionItem key={cat.slug} value={cat.slug}>
                <AccordionTrigger className="text-sm font-semibold">{cat.name}</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-wrap gap-2">
                    {cat.tags.map((t) => {
                      const on = favoriteTags.includes(t.slug);
                      return (
                        <Badge
                          key={t.slug}
                          onClick={() => toggleTag(t.slug)}
                          variant={on ? "default" : "outline"}
                          className="cursor-pointer select-none px-3 py-1.5 text-sm"
                        >
                          {on && <Check className="mr-1 h-3 w-3" />}
                          {t.display_name}
                        </Badge>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
          <CardDescription>The lowkey social stuff, opt-in only.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Share my activity with friends</div>
              <div className="text-xs text-muted-foreground">
                Accepted friends can see places you&apos;ve reviewed. Off by default.
              </div>
            </div>
            <Switch checked={shareActivity} onCheckedChange={setShareActivity} />
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {err && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="notice err">
            {err}
          </motion.div>
        )}
        {msg && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="notice">
            {msg}
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="submit" disabled={busy} className="w-full" size="lg">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
      </Button>
    </form>
  );
}
