"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Vote, Loader2, ArrowLeft, Share2, UserPlus, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import VenueCard from "./VenueCard";

const BUDGETS = [
  { label: "Under 100", value: 100 },
  { label: "Under 300", value: 300 },
  { label: "Whatever", value: 99999 },
];

function MessageBubble({ msg, mine }) {
  const author = msg.profile_public;
  const initials = (author?.display_name || "?").slice(0, 2).toUpperCase();
  return (
    <div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={safeUrl(author?.avatar_url)} alt="" />
        <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div
        className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
        style={{ background: mine ? "var(--purple)" : "var(--paper)", color: mine ? "var(--white)" : "var(--ink)", border: mine ? "none" : "1.5px solid var(--ink)" }}
      >
        {!mine && <div className="mb-0.5 text-[11px] font-bold opacity-70">{author?.display_name || "Someone"}</div>}
        {msg.body}
      </div>
    </div>
  );
}

function PollComposer({ groups, zones, onCreated }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState({});
  const [budget, setBudget] = useState(99999);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function toggleTag(cat, slug) {
    setSelected((prev) => {
      const cur = prev[cat.slug] || [];
      let next;
      if (cur.includes(slug)) next = cur.filter((s) => s !== slug);
      else if (cur.length >= cat.max_select) next = [...cur.slice(1), slug];
      else next = [...cur, slug];
      return { ...prev, [cat.slug]: next };
    });
  }

  const allTags = Object.values(selected).flat();

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${onCreated.groupId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: allTags, maxSpend: budget }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't start a vote");
      setOpen(false);
      setSelected({});
      onCreated.refresh();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <Button className="w-full" onClick={() => setOpen(true)}>
        <Vote className="h-4 w-4" /> Start a vote
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        {groups.map((cat) => (
          <div key={cat.slug}>
            <div className="mb-1.5 text-xs font-bold text-muted-foreground uppercase">{cat.name}</div>
            <div className="flex flex-wrap gap-1.5">
              {cat.tags.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleTag(cat, t.slug)}
                  className={`chip ${(selected[cat.slug] || []).includes(t.slug) ? "sel" : ""}`}
                  style={{ padding: "5px 12px", fontSize: 12 }}
                >
                  {t.display_name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <div className="mb-1.5 text-xs font-bold text-muted-foreground uppercase">Budget</div>
          <div className="flex flex-wrap gap-1.5">
            {BUDGETS.map((b) => (
              <button key={b.value} type="button" onClick={() => setBudget(b.value)} className={`chip ${budget === b.value ? "sel" : ""}`} style={{ padding: "5px 12px", fontSize: 12 }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>
        {err && <div className="notice err">{err}</div>}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={busy || allTags.length === 0} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Get 3 spots →"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PollResults({ poll, groupId, onVoted }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const max = Math.max(1, ...poll.options.map((o) => o.votes));

  async function vote(optionId) {
    setBusy(true);
    await fetch(`/api/groups/${groupId}/polls/${poll.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    setBusy(false);
    onVoted();
  }

  function shareLink() {
    const url = `${window.location.origin}/vote/${poll.share_token}`;
    navigator.clipboard?.writeText(url);
    if (navigator.share) navigator.share({ title: "Vote on where we're going", url }).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">
          {poll.expired ? "Vote closed" : "Vote open"} · {new Date(poll.created_at).toLocaleDateString()}
        </CardTitle>
        {!poll.expired && (
          <Button size="sm" variant="outline" onClick={shareLink}>
            <Share2 className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Share link"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {poll.options.map((o) => (
          <div key={o.optionId} className="rounded-lg border p-2.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>{o.venue?.name}</span>
              <span>{o.votes} vote{o.votes === 1 ? "" : "s"}</span>
            </div>
            <div className="result-bar">
              <div className={`result-fill${o.votes === max && o.votes > 0 ? " lead" : ""}`} style={{ width: `${(o.votes / max) * 100}%` }} />
            </div>
            {!poll.expired && (
              <Button size="sm" variant={poll.myVote?.option_id === o.optionId ? "default" : "outline"} className="mt-2 w-full" disabled={busy} onClick={() => vote(o.optionId)}>
                {poll.myVote?.option_id === o.optionId ? "Voted ✓" : "Vote"}
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MembersManager({ groupId, members, creatorId, currentUserId, onChanged }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [busy, setBusy] = useState(false);
  const isCreator = creatorId === currentUserId;
  const memberIds = new Set(members.map((m) => m.id));

  useEffect(() => {
    if (open && !friends.length) {
      fetch("/api/friends")
        .then((r) => r.json())
        .then((d) => setFriends((d.friends || []).map((f) => f.other)));
    }
  }, [open, friends.length]);

  async function addMember(userId) {
    setBusy(true);
    await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    onChanged();
  }

  async function removeMember(userId) {
    setBusy(true);
    await fetch(`/api/groups/${groupId}/members?userId=${userId}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
  }

  const addable = friends.filter((f) => !memberIds.has(f.id));

  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
        {open ? "Hide members" : "Manage members"}
      </button>
      {open && (
        <Card className="mt-2">
          <CardContent className="space-y-2 pt-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={safeUrl(m.avatar_url)} alt="" />
                    <AvatarFallback className="text-[10px] font-bold">{(m.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{m.display_name || "Someone"}</span>
                  {m.id === creatorId && <span className="text-[10px] text-muted-foreground">creator</span>}
                </div>
                {(m.id === currentUserId || (isCreator && m.id !== creatorId)) && (
                  <Button size="icon-sm" variant="ghost" disabled={busy} onClick={() => removeMember(m.id)}>
                    <UserMinus className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {addable.length > 0 && (
              <div className="border-t pt-2">
                <div className="mb-1 text-xs font-semibold text-muted-foreground">Add a friend</div>
                {addable.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-1">
                    <span className="text-sm">{f.display_name || "Friend"}</span>
                    <Button size="icon-sm" variant="outline" disabled={busy} onClick={() => addMember(f.id)}>
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function GroupDetailClient({ groupId, group, members: initialMembers, taxonomy, currentUserId }) {
  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [polls, setPolls] = useState([]);
  const bottomRef = useRef(null);

  const loadMembers = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    const d = await res.json();
    if (res.ok) setMembers(d.members || []);
  }, [groupId]);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/messages`);
    const d = await res.json();
    if (res.ok) setMessages(d.messages || []);
  }, [groupId]);

  const loadPolls = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}/polls`);
    const d = await res.json();
    if (res.ok) setPolls(d.polls || []);
  }, [groupId]);

  useEffect(() => {
    loadMessages();
    loadPolls();
  }, [loadMessages, loadPolls]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, () => {
        loadMessages();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    await fetch(`/api/groups/${groupId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    loadMessages();
  }

  return (
    <div className="space-y-5">
      <Link href="/groups" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Groups
      </Link>

      <div className="flex items-center gap-2">
        <h1 style={{ marginBottom: 0 }}>{group.name}</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex -space-x-2">
          {members.map((m) => (
            <Avatar key={m.id} className="h-8 w-8 border-2" style={{ borderColor: "var(--white)" }}>
              <AvatarImage src={safeUrl(m.avatar_url)} alt="" />
              <AvatarFallback className="text-xs font-bold">{(m.display_name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <MembersManager groupId={groupId} members={members} creatorId={group.created_by} currentUserId={currentUserId} onChanged={loadMembers} />
      </div>

      <PollComposer groups={taxonomy.groups} zones={taxonomy.zones} onCreated={{ groupId, refresh: loadPolls }} />

      <AnimatePresence>
        {polls.map((p) => (
          <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <PollResults poll={p} groupId={groupId} onVoted={loadPolls} />
          </motion.div>
        ))}
      </AnimatePresence>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Chat</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="mb-3 flex max-h-96 flex-col gap-2 overflow-y-auto">
            {!messages.length && <p className="text-sm text-muted-foreground">No messages yet, say hi.</p>}
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} mine={m.user_id === currentUserId} />
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Message the group…"
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <Button size="icon" onClick={send} disabled={!text.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
