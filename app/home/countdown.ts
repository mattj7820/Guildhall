/** How long until the next session, in words: "in 3 days", "tomorrow", "on now". */
export function countdown(at: Date, now: Date, locale?: string): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  // A session runs a few hours: it's on until then, and over after.
  if (minutes < -SESSION_MINUTES) return "the last one";
  if (minutes <= 0) return "on now";
  const words = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const days = daysBetween(now, at);
  if (days > 0) return words.format(days, "day");
  if (minutes < 60) return words.format(minutes, "minute");
  return words.format(Math.round(minutes / 60), "hour");
}

const SESSION_MINUTES = 4 * 60;

/** Calendar days, so tomorrow evening is "tomorrow" even if it's less than 24 hours away. */
function daysBetween(from: Date, to: Date): number {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day(to) - day(from)) / 86_400_000);
}
