export const EVENT_WEEKDAYS = [
  { value: 0, short: "Sun", long: "Sunday" }, { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" }, { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" }, { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
];

export function recurrenceLabel(event) {
  if (event?.recurrence_type !== "weekly") return "One-time event";
  const selected = EVENT_WEEKDAYS.filter((day) => (event.recurrence_days || []).map(Number).includes(day.value));
  if (!selected.length) return "Weekly";
  if (selected.length === 1) return `Every ${selected[0].long}`;
  return `Every ${selected.map((day) => day.short).join(", ")}`;
}
