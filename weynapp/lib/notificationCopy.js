/* Shared notification presentation.

   NotificationBell owned a private copy of `describe`. The new
   notification centre needs exactly the same wording and links, and two
   copies would drift the moment a notification type is added, so it
   lives here and both import it. Add a new `type` in one place. */

export function describe(notification) {
  const p = notification.payload || {};
  switch (notification.type) {
    case "poll_finished":
      return {
        text: `Everyone voted in ${p.groupName || "your group"}, time to go out! 🎉`,
        href: `/groups/${p.groupId}`,
        icon: "poll",
        action: "See the verdict",
      };
    case "poll_vote":
      return {
        text: `${p.voterName || "Someone"} voted in ${p.groupName || "your group"}`,
        href: `/groups/${p.groupId}`,
        icon: "poll",
        action: "Vote now",
      };
    case "group_message":
      return {
        text: `${p.senderName || "Someone"}: ${p.preview || "sent a message"}`,
        href: `/groups/${p.groupId}`,
        icon: "message",
        action: "Open chat",
      };
    default:
      return { text: "New activity", href: "/groups", icon: "bell", action: "Take a look" };
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/* "2 hours ago" / "Yesterday" / "3 days ago", as in the mockup.
   Falls back to a date once it stops being useful to count days. */
export function relativeTime(value) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;

  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
