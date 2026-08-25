"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, MessageSquare, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { describe, relativeTime } from "@/lib/notificationCopy";

const ICONS = { poll: Vote, message: MessageSquare, bell: Bell };

export default function NotificationCenter({ userId, initialNotifications = [] }) {
  const [items, setItems] = useState(initialNotifications);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const body = await res.json();
    if (res.ok) setItems(body.notifications || []);
  }, []);

  /* Same realtime channel the bell uses, so opening this page and
     leaving it open keeps it current. Distinct channel name, otherwise
     the two subscriptions collide when the bell is also mounted. */
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notification-centre-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    if (!unread || marking) return;
    setMarking(true);
    // Optimistic: the list is already on screen, waiting on the round
    // trip to grey out the dots just looks broken.
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      // fetch only rejects on a network failure, so a 401 or 500 lands
      // here as a perfectly ordinary response. Without this check the
      // optimistic update would stick and the dots would come back on
      // the next load with no explanation.
      if (!res.ok) await load();
    } catch {
      await load(); // network died, put the truth back
    }
    setMarking(false);
  }

  if (!items.length) {
    return (
      <div className="notif-empty" role="status">
        <Bell aria-hidden="true" />
        <strong>Nothing yet</strong>
        <p>Votes, group messages and plans will land here.</p>
        <Link className="btn primary" href="/groups">Go to your groups</Link>
      </div>
    );
  }

  return (
    <>
      <div className="notif-toolbar">
        <span className="notif-count">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </span>
        {unread > 0 && (
          <button type="button" className="btn small ghost" onClick={markAllRead} disabled={marking}>
            Mark all read
          </button>
        )}
      </div>

      <ul className="notif-list lv-stagger">
        {items.map((notification) => {
          const { text, href, icon, action } = describe(notification);
          const Icon = ICONS[icon] || Bell;
          return (
            <li
              key={notification.id}
              className={notification.read ? "notif-item" : "notif-item unread"}
            >
              {!notification.read && <span className="notif-dot" aria-label="Unread" />}
              <span className="notif-icon" aria-hidden="true"><Icon /></span>
              <div className="notif-body">
                <p className="notif-text">{text}</p>
                <time className="notif-time" dateTime={notification.created_at}>
                  {relativeTime(notification.created_at)}
                </time>
                <Link className="btn small" href={href}>{action}</Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
