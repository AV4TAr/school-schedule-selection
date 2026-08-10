/** Helpers for the "minutes since midnight" representation used everywhere. */

export const MINUTES_IN_DAY = 24 * 60;

/** "08:40" | "8:40" -> 520. Returns null when the input is not a valid time. */
export function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** 520 -> "08:40". The canonical form for <input type="time"> values. */
export function toTimeInput(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Format for display. English uses 12-hour clock, Spanish 24-hour, matching
 * what each audience expects to read on a printed schedule.
 */
export function formatTime(min: number, locale: string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const mm = String(m).padStart(2, "0");
  if (locale === "es") return `${String(h).padStart(2, "0")}:${mm}`;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
}

export function formatRange(startMin: number, endMin: number, locale: string): string {
  return `${formatTime(startMin, locale)} – ${formatTime(endMin, locale)}`;
}

/** 275 -> "4h 35m". Used for workload totals. */
export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** 275 -> 4.58, for numeric comparisons and charts. */
export function toHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}
