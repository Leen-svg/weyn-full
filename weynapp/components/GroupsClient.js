"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Loader2, MessageCircle, Clock3, Archive, RotateCcw, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { safeUrl } from "@/lib/sanitize";
import styles from "./AccountPages.module.css";

export default function GroupsClient() {
  const [groups, setGroups] = useState(null);
  const [archived, setArchived] = useState([]);
  const [friends, setFriends] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    const d = await res.json();
    setGroups(res.ok ? d.groups || [] : []);
    setArchived(res.ok ? d.archived || [] : []);
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
        body: JSON.stringify({ name, memberIds: [...picked], visibility }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't create group");
      window.location.href = `/groups/${d.id}`;
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function lifecycle(group, action) {
    if (action === "delete" && !window.confirm(`Delete “${group.name}” permanently? The chat and votes will be removed.`)) return;
    setBusy(true);
    setErr(null);
    const response = await fetch(`/api/groups/${group.id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "content-type": "application/json" },
      body: action === "delete" ? undefined : JSON.stringify({ action }),
    });
    const body = await response.json();
    if (!response.ok) setErr(body.error || "Couldn’t update that group");
    else await loadGroups();
    setBusy(false);
  }

  return (
    <div className={`${styles.groupsStack} social-stack groups-view`}>
      <div className={styles.groupOverview}>
        <div><MessageCircle /><span><strong>{groups?.length || 0}</strong><small>active groups</small></span></div>
        <div><Users /><span><strong>{friends.length}</strong><small>friends available</small></span></div>
      </div>
      <Card className={styles.groupCreate}>
        <CardContent className="space-y-3">
          {!creating ? (
            <Button className="w-full" onClick={() => setCreating(true)} disabled={!friends.length}>
              <Plus className="h-4 w-4" /> Create a group
            </Button>
          ) : (
            <>
              <Input placeholder="Group name, e.g. Weekend crew" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
              <fieldset className={styles.audienceGroup}>
                <legend>Who can see this group profile?</legend>
                <div className={styles.audienceOptions}>
                  {[
                    ["private", "Private", "Only invited members can see it"],
                    ["friends", "Friends", "The profile can be shared with accepted friends"],
                    ["public", "Public", "The profile can be shared publicly"],
                  ].map(([value, label, help]) => (
                    <label className={styles.audienceOption} key={value}>
                      <input type="radio" name="group-audience" value={value} checked={visibility === value} onChange={() => setVisibility(value)} />
                      <strong>{label}</strong><small>{help}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-muted-foreground">Group chat and votes always stay invite-only, regardless of profile visibility.</p>
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
                <Button className="flex-1" disabled={busy || !name.trim() || picked.size === 0 || !visibility} onClick={createGroup}>
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
      {groups?.length === 0 && <div className={styles.groupEmpty}><MessageCircle /><strong>Your group chats will live here</strong><span>Add a friend, start a group, then plan and vote without leaving the conversation.</span></div>}

      <div className={styles.groupList}>
      {groups?.map((g) => (
          <div className="app-reveal" key={g.id}>
            <Link href={`/groups/${g.id}`}>
              <Card className={`${styles.groupCard} transition-colors hover:bg-accent`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" /> {g.name}
                  </CardTitle>
                  <span className="group-recent"><span className={`saved-visibility ${g.visibility || "private"}`}>{g.visibility || "private"}</span><Clock3 /> {new Date(g.recent_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
                </CardHeader>
                <CardContent className="group-list-members pt-0">
                  <div className="flex -space-x-2">{g.members.slice(0, 6).map((m) => (
                    <Avatar key={m.id} className="h-7 w-7 border-2" style={{ borderColor: "var(--white)" }}>
                      <AvatarImage src={safeUrl(m.avatar_url)} alt="" />
                      <AvatarFallback className="text-[10px] font-bold">{(m.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  ))}</div><span>{g.members.length} member{g.members.length === 1 ? "" : "s"} · open chat →</span>
                </CardContent>
              </Card>
            </Link>
          </div>
      ))}
      </div>

      {!!archived.length && (
        <details className="card">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 font-semibold"><span className="flex items-center gap-2"><Archive className="h-4 w-4" /> Archived groups</span><span>{archived.length}</span></summary>
          <div className="space-y-2 px-4 pb-4">
            {archived.map((group) => (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3" key={group.id}>
                <span><strong className="block">{group.name}</strong><small className="text-muted-foreground">{group.members.length} member{group.members.length === 1 ? "" : "s"}</small></span>
                <span className="flex gap-2">
                  <Button size="icon-sm" variant="outline" disabled={busy} onClick={() => lifecycle(group, "restore")} aria-label={`Restore ${group.name}`}><RotateCcw className="h-4 w-4" /></Button>
                  <Button size="icon-sm" variant="outline" disabled={busy} onClick={() => lifecycle(group, "delete")} aria-label={`Delete ${group.name}`}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
