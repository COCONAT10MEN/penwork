export function greeting(hour: number): string {
  if (hour < 5 || hour >= 18) return "Good evening";
  return hour < 12 ? "Good morning" : "Good afternoon";
}

/** "Today", "Yesterday" or a short date, for the last time a deck was opened. */
export function whenOpened(iso: string, now: Date): string {
  const then = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(then)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
