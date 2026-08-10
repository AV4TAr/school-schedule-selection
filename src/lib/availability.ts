/**
 * The single definition of "can this person work this shift".
 *
 * The solver, the stored-schedule analysis and the manual-assignment action all
 * have to agree on this, or the screen contradicts the solver and a manual edit
 * can smuggle in something the solver would never produce. It lives here so
 * there is exactly one copy.
 */

import type { AvailabilityWindow, Preference, Shift } from "./types";

/** Most positive first — used to pick between overlapping windows. */
const PREFERENCE_RANK: Record<Preference, number> = {
  preferred: 0,
  neutral: 1,
  avoid: 2,
};

/**
 * The window that lets someone work the whole of `shift`, or undefined.
 *
 * A *single* window must cover it end to end: two adjacent windows do not
 * combine, because a boundary between them means a break. When several windows
 * qualify, the one the person feels best about wins, so a "preferred" block is
 * never masked by an overlapping "neutral" one.
 */
export function coveringWindow(
  shift: Pick<Shift, "weekday" | "startMin" | "endMin">,
  windows: AvailabilityWindow[],
): AvailabilityWindow | undefined {
  let best: AvailabilityWindow | undefined;
  for (const w of windows) {
    if (
      w.weekday !== shift.weekday ||
      w.startMin > shift.startMin ||
      w.endMin < shift.endMin
    ) {
      continue;
    }
    if (!best || PREFERENCE_RANK[w.preference] < PREFERENCE_RANK[best.preference]) {
      best = w;
    }
  }
  return best;
}

export function isAvailable(
  shift: Pick<Shift, "weekday" | "startMin" | "endMin">,
  windows: AvailabilityWindow[],
): boolean {
  return coveringWindow(shift, windows) !== undefined;
}

/** How the person feels about working this shift. Neutral when unavailable. */
export function preferenceFor(
  shift: Pick<Shift, "weekday" | "startMin" | "endMin">,
  windows: AvailabilityWindow[],
): Preference {
  return coveringWindow(shift, windows)?.preference ?? "neutral";
}

/** Group windows by person once, for callers that check many shifts. */
export function windowsByPerson(
  windows: AvailabilityWindow[],
): Map<number, AvailabilityWindow[]> {
  const map = new Map<number, AvailabilityWindow[]>();
  for (const w of windows) {
    const list = map.get(w.personId);
    if (list) list.push(w);
    else map.set(w.personId, [w]);
  }
  return map;
}
