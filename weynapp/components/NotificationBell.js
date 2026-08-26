"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

function describe(n) {
  const p = n.payload || {};
  switch (n.type) {
    case "poll_finished":
      return { text: `Everyone voted in ${p.groupName || "your group"}, time to go out! 🎉`, href: `/groups/${p.groupId}` };
    case "poll_vote":
      return { text: `${p.voterName || "Someone"} voted in ${p.groupName || "your group"}`, href: `/groups/${p.groupId}` };
    case "group_message":
      return { text: `${p.senderName || "Someone"}: ${p.preview || "sent a message"}`, href: `/groups/${p.groupId}` };
    default:
      return { text: "New activity", href: "/groups" };
  }
}

export default function NotificationBell({ userId }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    const d = await res.json();
    if (res.ok) setItems(d.notifications || []);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const unread = items.filter((n) => !n.read).length;

  async function onOpenChange(next) {
    setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform hover:-translate-y-0.5"
            style={{ borderColor: "var(--ink)" }}
            aria-label="Notifications"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1" variant="destructive">
            {unread > 9 ? "9+" : unread}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {items.length === 0 && <div className="px-3 py-4 text-center text-sm text-muted-foreground">No notifications yet.</div>}
        {items.map((n) => {
          const { text, href } = describe(n);
          return (
            <DropdownMenuItem key={n.id} render={<Link href={href} />} className={!n.read ? "font-semibold" : undefined}>
              {text}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

