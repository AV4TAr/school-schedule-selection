/**
 * Derives coverage and workload figures from a *stored* set of assignments.
 *
 * The solver reports the same numbers for the plan it just produced, but the
 * saved schedule can drift once shifts or availability are edited underneath
 * it. Recomputing from what is actually in the database keeps the screen honest.
 */

import type {
  Assignment,
  AvailabilityWindow,
  CoverageGap,
  Person,
  PersonWorkload,
  Preference,
  Shift,
  Weekday,
} from "./types";

export interface ScheduleAnalysis {
  gaps: CoverageGap[];
  workloads: PersonWorkload[];
  totalStaffedMinutes: number;
  /** Minutes between the most and least loaded active person. */
  spreadMinutes: number;
  /** Assignments that no longer fit the person's availability. */
  conflicts: Assignment[];
}

export function analyzeSchedule(
  people: Person[],
  shifts: Shift[],
  assignments: Assignment[],
  availability: AvailabilityWindow[],
): ScheduleAnalysis {
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const activePeople = people.filter((p) => p.active);

  const gaps: CoverageGap[] = [];
  for (const shift of shifts) {
    if (!shift.active) continue;
    const assigned = assignments.filter((a) => a.shiftId === shift.id).length;
    if (assigned < shift.requiredIdeal) {
      gaps.push({
        shiftId: shift.id,
        assigned,
        requiredMin: shift.requiredMin,
        requiredIdeal: shift.requiredIdeal,
        critical: assigned < shift.requiredMin,
      });
    }
  }

  const conflicts: Assignment[] = [];
  const workloads: PersonWorkload[] = people.map((person) => {
    const windows = availability.filter((w) => w.personId === person.id);
    const mine = assignments
      .filter((a) => a.personId === person.id)
      .map((a) => shiftById.get(a.shiftId))
      .filter((s): s is Shift => Boolean(s));

    for (const a of assignments.filter((x) => x.personId === person.id)) {
      const shift = shiftById.get(a.shiftId);
      if (!shift) continue;
      const covered = windows.some(
        (w) =>
          w.weekday === shift.weekday &&
          w.startMin <= shift.startMin &&
          w.endMin >= shift.endMin,
      );
      if (!covered) conflicts.push(a);
    }

    let totalMinutes = 0;
    let idleMinutes = 0;
    let preferredMinutes = 0;
    let avoidedMinutes = 0;
    const daysWorked = new Set<Weekday>();

    /** Same rule as the solver: the most positive covering window wins. */
    const preferenceFor = (shift: Shift): Preference => {
      const rank: Record<Preference, number> = { preferred: 0, neutral: 1, avoid: 2 };
      const best = windows
        .filter(
          (w) =>
            w.weekday === shift.weekday &&
            w.startMin <= shift.startMin &&
            w.endMin >= shift.endMin,
        )
        .sort((a, b) => rank[a.preference] - rank[b.preference])[0];
      return best?.preference ?? "neutral";
    };

    for (const weekday of [1, 2, 3, 4, 5, 6, 7] as Weekday[]) {
      const dayShifts = mine
        .filter((s) => s.weekday === weekday)
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      if (dayShifts.length === 0) continue;
      daysWorked.add(weekday);

      let lastEnd = -1;
      for (const shift of dayShifts) {
        let worked: number;
        if (lastEnd < 0) {
          worked = shift.endMin - shift.startMin;
        } else {
          // Overlapping shifts are the same post: count wall-clock time once.
          worked = Math.max(0, shift.endMin - Math.max(shift.startMin, lastEnd));
          idleMinutes += Math.max(0, shift.startMin - lastEnd);
        }
        totalMinutes += worked;

        const preference = preferenceFor(shift);
        if (preference === "preferred") preferredMinutes += worked;
        else if (preference === "avoid") avoidedMinutes += worked;

        lastEnd = Math.max(lastEnd, shift.endMin);
      }
    }

    const availableDays = new Set(windows.map((w) => w.weekday));
    return {
      personId: person.id,
      totalMinutes,
      idleMinutes,
      preferredMinutes,
      avoidedMinutes,
      daysWorked: [...daysWorked].sort((a, b) => a - b),
      daysOff: [...availableDays].filter((d) => !daysWorked.has(d)).sort((a, b) => a - b),
    };
  });

  const activeTotals = workloads
    .filter((w) => activePeople.some((p) => p.id === w.personId))
    .map((w) => w.totalMinutes);

  return {
    gaps,
    workloads,
    totalStaffedMinutes: workloads.reduce((sum, w) => sum + w.totalMinutes, 0),
    spreadMinutes:
      activeTotals.length > 0 ? Math.max(...activeTotals) - Math.min(...activeTotals) : 0,
    conflicts,
  };
}

/**
 * Groups shifts that represent the same slot on different weekdays, so the
 * schedule can be laid out as a time-by-day matrix like a printed rota.
 */
export interface ShiftRow {
  key: string;
  name: string;
  startMin: number;
  endMin: number;
  byWeekday: Map<Weekday, Shift>;
}

export function buildShiftRows(shifts: Shift[]): ShiftRow[] {
  const rows = new Map<string, ShiftRow>();
  for (const shift of shifts) {
    if (!shift.active) continue;
    const key = `${shift.name}|${shift.startMin}|${shift.endMin}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        name: shift.name,
        startMin: shift.startMin,
        endMin: shift.endMin,
        byWeekday: new Map(),
      };
      rows.set(key, row);
    }
    row.byWeekday.set(shift.weekday, shift);
  }
  return [...rows.values()].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
}
