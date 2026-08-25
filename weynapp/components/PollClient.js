"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import VenueCard from "./VenueCard";

function getFingerprint() {
  let fp = localStorage.getItem("weyn_fp");
  if (!fp) { fp = crypto.randomUUID(); localStorage.setItem("weyn_fp", fp); }
  return fp;
}

export default function PollClient({ code }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [name, setName] = useState("");
  const [voted, setVoted] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/polls/${code}`);
    const d = await res.json();
    if (!res.ok) { setErr(d.error); return; }
    setData(d);
  }, [code]);

  useEffect(() => {
    load();
    setName(localStorage.getItem("weyn_name") || "");
    setVoted(localStorage.getItem(`weyn_voted_${code}`));
  }, [code, load]);

  useEffect(() => {
    if (!data?.poll?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`poll-${data.poll.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `poll_id=eq.${data.poll.id}` }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.poll?.id, load]);

  async function vote(optionId) {
    setBusy(true); setErr(null);
    localStorage.setItem("weyn_name", name);
    const res = await fetch(`/api/polls/${code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, name, fingerprint: getFingerprint() }),
    });
    const d = await res.json();
    if (!res.ok) setErr(d.error);
    else {
      localStorage.setItem(`weyn_voted_${code}`, optionId);
      setVoted(optionId);
      load();
    }
    setBusy(false);
  }

  if (err && !data) return <div className="notice err">{err}</div>;
  if (!data) return <p className="sub">Loading the vote…</p>;

  const max = Math.max(1, ...data.options.map((o) => o.votes));

  /* A winner is only declared once voting has closed AND one option is
     alone at the top. While the poll is open the same option is only
     ever "leading", and a tie is never a win, it is a tie. Calling a
     result early or calling a draw a victory is how a group ends up
     somewhere half of them did not agree to. */
  const topVotes = Math.max(0, ...data.options.map((o) => o.votes));
  const tiedAtTop = data.options.filter((o) => o.votes === topVotes).length > 1;
  const winnerId =
    data.poll.expired && topVotes > 0 && !tiedAtTop
      ? data.options.find((o) => o.votes === topVotes)?.optionId
      : null;

  return (
    <div className="vote-flow">
      <h1>Pick one.</h1>
      <p className="sub">
        {data.poll.expired
          ? "Voting has closed, here's the verdict."
          : "Tap your pick. You can change your mind until the poll closes."}
      </p>

      {!data.poll.expired && (
        <div className="field">
          <label>Your name <span className="hint">(so the group knows who voted)</span></label>
          <input type="text" value={name} maxLength={40} placeholder="e.g. Sara" onChange={(e) => setName(e.target.value)} />
        </div>
      )}

      {err && <div className="notice err">{err}</div>}

      <div className="venue-list-single">
      {data.options.map((o) => (
        <VenueCard key={o.optionId} venue={o.venue} picked={voted === o.optionId}>
          <div className={`poll-result${winnerId === o.optionId ? " winner" : ""}`}>
            {winnerId === o.optionId && (
              <span className="poll-winner-badge">
                <span aria-hidden="true">🏆</span> Winner
              </span>
            )}
            <div className="poll-result-head">
              <span>
                {o.votes} vote{o.votes === 1 ? "" : "s"}
                {o.voters.length ? `, ${o.voters.join(", ")}` : ""}
              </span>
              <span className="poll-result-share">
                {/* Share of all votes cast, not share of the leader, so
                    the numbers across options add up to 100%. */}
                {data.totalVotes > 0 ? Math.round((o.votes / data.totalVotes) * 100) : 0}%
              </span>
            </div>
            {voted === o.optionId && <span className="poll-your-pick">✓ your pick</span>}
            <div className="result-bar">
              <div
                className={`result-fill${o.votes === max && o.votes > 0 ? " lead" : ""}`}
                style={{ width: `${(o.votes / max) * 100}%` }}
              />
            </div>
            {!data.poll.expired && (
              <button
                className={`btn small block${voted === o.optionId ? " primary" : ""}`}
                style={{ marginTop: 12 }}
                disabled={busy}
                onClick={() => vote(o.optionId)}
              >
                {voted === o.optionId ? "Voted ✓" : "Vote for this"}
              </button>
            )}
          </div>
        </VenueCard>
      ))}
      </div>

      <p className="sub" style={{ marginTop: 22 }}>
        {data.totalVotes} vote{data.totalVotes === 1 ? "" : "s"} so far · powered by{" "}
        <a href="/" style={{ fontWeight: 800, color: "var(--ink)" }}>weyn</a>
      </p>
    </div>
  );
}

