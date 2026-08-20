"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";

export default function GroupsClient() {
  const [groups, setGroups] = useState(null);
  const [friends, setFriends] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const d = await res.json();
    setGroups(res.ok ? d.groups || [] : []);
  }, []);

  useEffect(() => {
    loadGroups();
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => setFriends((d.friends || []).map((f) => f.other)));
  }, [loadGroups]);

  function togglePick(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createGroup() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memberIds: [...picked] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't create group");
      window.location.href = `/groups/${d.id}`;
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="social-stack groups-view space-y-5">
      <Card>
        <CardContent className="space-y-3 pt-6">
          {!creating ? (
            <Button className="w-full" onClick={() => setCreating(true)} disabled={!friends.length}>
              <Plus className="h-4 w-4" /> Create a group
            </Button>
          ) : (
            <>
              <Input placeholder="Group name, e.g. Weekend crew" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {friends.map((f) => {
                  const on = picked.has(f.id);
                  const initials = (f.display_name || "?").slice(0, 2).toUpperCase();
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => togglePick(f.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${on ? "bg-accent" : ""}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={safeUrl(f.avatar_url)} alt="" />
                        <AvatarFallback className="text-xs font-bold">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{f.display_name || "Friend"}</span>
                      {on && <span className="ml-auto text-primary">✓</span>}
                    </button>
                  );
                })}
              </div>
              {err && <div className="notice err">{err}</div>}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCreating(false)} disabled={busy}>
                  Cancel
                </Button>
                <Button className="flex-1" disabled={busy || !name.trim() || picked.size === 0} onClick={createGroup}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </>
          )}
          {!friends.length && !creating && (
            <p className="text-center text-xs text-muted-foreground">
              Add friends first, then you can group up and vote together.
            </p>
          )}
        </CardContent>
      </Card>

      {groups === null && <p className="sub">Loading your groups…</p>}
      {groups?.length === 0 && <p className="sub">No groups yet, start one above.</p>}

      {groups?.map((g) => (
          <div className="app-reveal" key={g.id}>
            <Link href={`/groups/${g.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" /> {g.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex -space-x-2 pt-0">
                  {g.members.slice(0, 6).map((m) => (
                    <Avatar key={m.id} className="h-7 w-7 border-2" style={{ borderColor: "var(--white)" }}>
                      <AvatarImage src={safeUrl(m.avatar_url)} alt="" />
                      <AvatarFallback className="text-[10px] font-bold">{(m.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}
                </CardContent>
              </Card>
            </Link>
          </div>
      ))}
    </div>
  );
}

