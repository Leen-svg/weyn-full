"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, UserPlus, Check, X, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import useDebounce from "@/hooks/use-debounce";
import { safeUrl } from "@/lib/sanitize";

function PersonRow({ person, right }) {
  const initials = (person.display_name || "?").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={safeUrl(person.avatar_url)} alt="" />
          <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{person.display_name || "Someone"}</span>
      </div>
      {right}
    </div>
  );
}

export default function FriendsClient() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [sentIds, setSentIds] = useState(new Set());

  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [activity, setActivity] = useState([]);
  const [busy, setBusy] = useState(false);

  const loadFriends = useCallback(async () => {
    const res = await fetch("/api/friends");
    const d = await res.json();
    if (res.ok) {
      setFriends(d.friends || []);
      setIncoming(d.incoming || []);
      setOutgoing(d.outgoing || []);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    const res = await fetch("/api/friends/activity");
    const d = await res.json();
    if (res.ok) setActivity(d.activity || []);
  }, []);

  useEffect(() => {
    loadFriends();
    loadActivity();
  }, [loadFriends, loadActivity]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    fetch(`/api/friends/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results || []))
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  async function sendRequest(personId) {
    setBusy(true);
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresseeId: personId }),
    });
    if (res.ok) setSentIds((prev) => new Set(prev).add(personId));
    setBusy(false);
    loadFriends();
  }

  async function respond(friendshipId, action) {
    setBusy(true);
    await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendshipId, action }),
    });
    setBusy(false);
    loadFriends();
    loadActivity();
  }

  async function removeFriendship(friendshipId) {
    setBusy(true);
    await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
    setBusy(false);
    loadFriends();
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Find people</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden">
                {results.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    right={
                      <Button size="sm" disabled={busy || sentIds.has(p.id)} onClick={() => sendRequest(p.id)}>
                        {sentIds.has(p.id) ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      </Button>
                    }
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {searching && <p className="mt-2 text-xs text-muted-foreground">Searching…</p>}
        </CardContent>
      </Card>

      {incoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Requests ({incoming.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {incoming.map((f) => (
              <PersonRow
                key={f.id}
                person={f.other}
                right={
                  <div className="flex gap-1.5">
                    <Button size="icon-sm" disabled={busy} onClick={() => respond(f.id, "accept")}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" disabled={busy} onClick={() => respond(f.id, "decline")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your friends ({friends.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {!friends.length && <p className="text-sm text-muted-foreground">No friends yet, search above to add some.</p>}
          {friends.map((f) => (
            <PersonRow
              key={f.id}
              person={f.other}
              right={
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => removeFriendship(f.id)}>
                  Remove
                </Button>
              }
            />
          ))}
          {outgoing.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Pending</div>
              {outgoing.map((f) => (
                <PersonRow key={f.id} person={f.other} right={<span className="text-xs text-muted-foreground">Sent</span>} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Friend activity</CardTitle>
        </CardHeader>
        <CardContent>
          {!activity.length && (
            <p className="text-sm text-muted-foreground">
              Nothing to show, friends need to accept and turn on &quot;share my activity&quot; in their profile.
            </p>
          )}
          {activity.map((a) => (
            <div key={a.id} className="border-b py-2.5 last:border-0">
              <div className="flex items-center gap-1.5 text-sm">
                <span className="font-semibold">{a.friend?.display_name || "A friend"}</span>
                <span className="text-muted-foreground">rated</span>
                <span className="font-semibold">{a.venues?.name}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-3.5 w-3.5 ${i < a.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
