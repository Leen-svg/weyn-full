"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Vote, Loader2, ArrowLeft, Share2, UserPlus, UserMinus, Archive, ChevronDown, MapPin } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeUrl } from "@/lib/sanitize";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const BUDGETS = [
  { label: "Under 100", value: 100 },
  { label: "Under 300", value: 300 },
  { label: "Whatever", value: 99999 },
];

function MessageBubble({ msg, mine }) {
  const author = msg.profile_public;
  const initials = (author?.display_name || "?").slice(0, 2).toUpperCase();
  const sentAt = new Date(msg.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className={`message-row flex items-end gap-2 ${mine ? "mine flex-row-reverse" : ""}`}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={safeUrl(author?.avatar_url)} alt="" />
        <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
      </Avatar>
      <div className="message-bubble max-w-[78%] rounded-2xl px-3 py-2 text-sm">
        {!mine && <div className="mb-0.5 text-[11px] font-bold opacity-70">{author?.display_name || "Someone"}</div>}
        <div>{msg.body}</div>
        <div className="message-time">{sentAt}</div>
      </div>
    </div>
  );
}

function PollComposer({ groups, zones, onCreated, hasCurrent = false }) {
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
      <div className="new-vote-action">
        <Button variant={hasCurrent ? "outline" : "default"} className="w-full" onClick={() => setOpen(true)}>
          <Vote className="h-4 w-4" /> {hasCurrent ? "Start a new vote" : "Start a vote"}
        </Button>
        {hasCurrent && <p>Starting another vote moves this one to the archive.</p>}
      </div>
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

function PollResults({ poll, groupId, onVoted, archived = false }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const max = Math.max(1, ...poll.options.map((o) => o.votes));
  const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];
  const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);

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
    <Card className={`group-poll-card${archived ? " archived" : ""}`}>
      <CardHeader className="group-poll-header flex-row items-center justify-between pb-2">
        <div>
          <span className={`poll-status ${poll.expired || archived ? "closed" : "open"}`}>{poll.expired || archived ? "Archived" : "Open now"}</span>
          <CardTitle className="mt-1 text-base">
            {archived && winner ? `${winner.venue?.name || "Vote"} led` : "Where are we going?"}
          </CardTitle>
          <p>{new Date(poll.created_at).toLocaleDateString()} · {totalVotes} vote{totalVotes === 1 ? "" : "s"}</p>
        </div>
        {!archived && !poll.expired && (
          <Button size="sm" variant="outline" onClick={shareLink}>
            <Share2 className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Share"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="group-poll-options space-y-2 pt-0">
        {poll.options.map((o) => {
          const venue = o.venue || {};
          const coverUrl = safeUrl(venue.cover_url);
          const mapsUrl = safeUrl(venue.google_maps_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue.name || "Venue"} ${venue.neighborhood || ""}`)}`;
          const spend = venue.avg_spend_aed === 0
            ? "Free"
            : venue.avg_spend_aed
              ? `~${venue.avg_spend_aed} AED pp`
              : null;
          const description = venue.description?.trim()
            || `${venue.name || "This place"} is one of Weyn's picks${venue.neighborhood ? ` in ${venue.neighborhood}` : ""}.`;

          return (
            <article key={o.optionId} className={`vote-option${poll.myVote?.option_id === o.optionId ? " my-vote" : ""}`}>
              <div className={`vote-venue-media${coverUrl ? " has-image" : ""}`}>
                {coverUrl ? (
                  <img src={coverUrl} alt={`${venue.name || "Venue"} preview`} loading="lazy" decoding="async" />
                ) : (
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div className="vote-option-copy">
                <div className="vote-option-title">
                  <h3>{venue.name || "Venue"}</h3>
                  <span className="vote-count" aria-label={`${o.votes} vote${o.votes === 1 ? "" : "s"}`}>{o.votes}</span>
                </div>
                {(venue.neighborhood || spend) && (
                  <p className="vote-venue-meta">{[venue.neighborhood, spend].filter(Boolean).join(" · ")}</p>
                )}
                <p className="vote-venue-description">{description}</p>
                <a className="vote-venue-map" href={mapsUrl} target="_blank" rel="noreferrer">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Maps
                </a>
                <div className="result-bar" aria-label={`${o.votes} vote${o.votes === 1 ? "" : "s"}`}>
                  <div className={`result-fill${o.votes === max && o.votes > 0 ? " lead" : ""}`} style={{ width: `${(o.votes / max) * 100}%` }} />
                </div>
              </div>
              {!archived && !poll.expired && (
                <Button size="sm" variant={poll.myVote?.option_id === o.optionId ? "default" : "outline"} disabled={busy} onClick={() => vote(o.optionId)}>
                  {poll.myVote?.option_id === o.optionId ? "Voted" : "Vote"}
                </Button>
              )}
            </article>
          );
        })}
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
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState("");
  const [polls, setPolls] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [chatError, setChatError] = useState(null);
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
    if (messages?.length) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages?.length]);

  async function send() {
    const body = text.trim();
    if (!body || sendBusy) return;
    const optimisticId = `pending-${Date.now()}`;
    const currentMember = members.find((member) => member.id === currentUserId);
    const optimisticMessage = {
      id: optimisticId,
      body,
      user_id: currentUserId,
      created_at: new Date().toISOString(),
      profile_public: currentMember || null,
    };
    setText("");
    setChatError(null);
    setSendBusy(true);
    setMessages((current) => [...(current || []), optimisticMessage]);
    try {
      const response = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Message failed to send");
      setMessages((current) => (current || []).map((message) => (
        message.id === optimisticId ? { ...data.message, profile_public: currentMember || null } : message
      )));
    } catch (error) {
      setMessages((current) => (current || []).filter((message) => message.id !== optimisticId));
      setText(body);
      setChatError(error.message);
    } finally {
      setSendBusy(false);
    }
  }

  const currentPoll = polls?.find((poll) => !poll.expired) || null;
  const archivedPolls = (polls || []).filter((poll) => poll.id !== currentPoll?.id);

  return (
    <div className="social-stack group-detail-view space-y-5">
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

      <section className="group-current-vote" aria-labelledby="current-vote-heading">
        <div className="group-section-heading">
          <div>
            <span>Decision</span>
            <h2 id="current-vote-heading">Current vote</h2>
          </div>
          {archivedPolls.length > 0 && (
            <button
              type="button"
              className="vote-archive-button"
              aria-expanded={archiveOpen}
              aria-controls="vote-archive"
              onClick={() => setArchiveOpen((open) => !open)}
            >
              <Archive className="h-4 w-4" /> {archivedPolls.length} old <ChevronDown className={`h-3.5 w-3.5 ${archiveOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {polls === null && <div className="group-loading-card">Loading the latest vote…</div>}
        {polls !== null && currentPoll && <PollResults poll={currentPoll} groupId={groupId} onVoted={loadPolls} />}
        {polls !== null && !currentPoll && (
          <div className="group-empty-vote">
            <Vote className="h-5 w-5" />
            <span><strong>No vote running</strong><small>Start one and settle the plan here.</small></span>
          </div>
        )}
        {polls !== null && <PollComposer groups={taxonomy.groups} zones={taxonomy.zones} onCreated={{ groupId, refresh: loadPolls }} hasCurrent={!!currentPoll} />}
      </section>

      <Card className="group-chat">
        <CardHeader className="group-chat-header pb-2">
          <div>
            <span>Conversation</span>
            <CardTitle className="text-base">Group chat</CardTitle>
          </div>
          <small>{members.length} member{members.length === 1 ? "" : "s"}</small>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="group-chat-log" aria-live="polite">
            {messages === null && <p className="text-sm text-muted-foreground">Loading messages…</p>}
            {messages?.length === 0 && <p className="text-sm text-muted-foreground">No messages yet—say hi.</p>}
            {messages?.map((m, index) => (
              <div className="message-entry" key={m.id}>
                {(index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(m.created_at).toDateString()) && (
                  <div className="message-day"><span>{new Date(m.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span></div>
                )}
                <MessageBubble msg={m} mine={m.user_id === currentUserId} />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {chatError && <div className="group-chat-error" role="alert">{chatError}</div>}
          <form className="group-chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <Input
              placeholder="Message the group…"
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim() || sendBusy}>
              {sendBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>

      {archiveOpen && archivedPolls.length > 0 && (
        <section id="vote-archive" className="vote-archive app-reveal" aria-labelledby="vote-archive-heading">
          <div className="group-section-heading">
            <div>
              <span>History</span>
              <h2 id="vote-archive-heading">Vote archive</h2>
            </div>
          </div>
          <div className="vote-archive-list">
            {archivedPolls.map((poll) => <PollResults key={poll.id} poll={poll} groupId={groupId} onVoted={loadPolls} archived />)}
          </div>
        </section>
      )}
    </div>
  );
}

