/**
 * Weekly supervision-schedule solver.
 *
 * The search is split in two phases because the only thing that couples one day
 * to another is the *weekly* objective (fair hours, day off). Within a day the
 * constraints are purely local.
 *
 *   1. For each weekday, enumerate every feasible staffing pattern. A pattern is
 *      rejected as soon as it breaks availability, the overlap rule or the
 *      maximum-gap rule, so the recursion prunes early and stays small.
 *   2. Collapse each day's patterns by their "minutes worked per person" vector.
 *      Two patterns with the same vector are interchangeable for the weekly
 *      objective, so we only keep the cheaper one. This turns thousands of
 *      patterns into a few dozen.
 *   3. Combine the days with branch and bound, using the sum of each remaining
 *      day's cheapest pattern as an admissible lower bound.
 *
 * For a team of this size the search is exhaustive and the result is provably
 * optimal; `maxSearchMs` only exists so a much larger roster can never hang the
 * UI (the best solution found so far is returned with `optimal: false`).
 */

import {
  type Assignment,
  type AvailabilityWindow,
  type CoverageGap,
  type Person,
  type PersonWorkload,
  type Shift,
  type SolveResult,
  type SolverSettings,
  type Weekday,
} from "./types";

export interface SolveInput {
  people: Person[];
  availability: AvailabilityWindow[];
  shifts: Shift[];
  /** User-locked assignments the solver must honour. */
  pins?: Assignment[];
  settings: SolverSettings;
}

/** A candidate staffing of every shift on a single weekday. */
interface DayPattern {
  /** Parallel to the day's shift list: the person indices staffing each shift. */
  perShift: number[][];
  /** Clock minutes worked that day, indexed by person. */
  minutes: number[];
  /** Waiting minutes between shifts that day, indexed by person. */
  idle: number[];
  /** Understaffing + idle cost. Independent of the rest of the week. */
  localCost: number;
}

interface DayPlan {
  weekday: Weekday;
  /** Shifts of this day, sorted by start time (the recursion relies on it). */
  shifts: Shift[];
  patterns: DayPattern[];
}

/**
 * Whether `person` can work the whole of `shift` — a single availability window
 * must cover it end to end. Two adjacent windows do not combine, which is
 * deliberate: a break in the middle of a window means they are unavailable.
 */
function isAvailable(shift: Shift, windows: AvailabilityWindow[]): boolean {
  return windows.some(
    (w) =>
      w.weekday === shift.weekday &&
      w.startMin <= shift.startMin &&
      w.endMin >= shift.endMin,
  );
}

function understaffCost(assigned: number, shift: Shift, settings: SolverSettings): number {
  const { understaffCritical, understaffIdeal } = settings.weights;
  const belowMin = Math.max(0, shift.requiredMin - assigned);
  const belowIdeal = Math.max(0, shift.requiredIdeal - assigned);
  return belowMin * understaffCritical + (belowIdeal - belowMin) * understaffIdeal;
}

/**
 * Enumerate every feasible pattern for one day, then keep only the cheapest
 * pattern per distinct minutes-per-person vector.
 */
function enumerateDay(
  weekday: Weekday,
  shifts: Shift[],
  eligible: number[][],
  pinnedPerShift: number[][],
  peopleCount: number,
  settings: SolverSettings,
): DayPlan {
  const { maxGapMinutes, maxOverlapMinutes } = settings;

  // Per-person running state, mutated in place as the recursion descends.
  const lastEnd = new Array<number>(peopleCount).fill(-1);
  const minutes = new Array<number>(peopleCount).fill(0);
  const idle = new Array<number>(peopleCount).fill(0);

  const chosen: number[][] = shifts.map(() => []);
  const best = new Map<string, DayPattern>();

  // Precompute, per shift, the bitmasks worth trying over its eligible list.
  const shiftMasks: number[][] = shifts.map((shift, i) => {
    const elig = eligible[i];
    const pinned = pinnedPerShift[i];
    // Never staff above ideal: extra bodies cost idle/fairness and buy nothing.
    // Pins can push past it, so honour whichever is larger.
    const cap = Math.max(shift.requiredIdeal, pinned.length);
    let pinnedMask = 0;
    for (const p of pinned) {
      const idx = elig.indexOf(p);
      if (idx >= 0) pinnedMask |= 1 << idx;
    }
    const masks: number[] = [];
    for (let mask = 0; mask < 1 << elig.length; mask++) {
      if ((mask & pinnedMask) !== pinnedMask) continue;
      if (popcount(mask) > cap) continue;
      masks.push(mask);
    }
    // Fuller staffing first: the first complete pattern found is then a good
    // incumbent, which makes the weekly branch-and-bound prune harder.
    masks.sort((a, b) => popcount(b) - popcount(a));
    return masks;
  });

  /** Records one mutation so the recursion can unwind it exactly. */
  interface UndoEntry {
    person: number;
    prevEnd: number;
    worked: number;
    gapAdded: number;
  }
  const undoStack: UndoEntry[] = [];

  function rollback(count: number) {
    for (let k = 0; k < count; k++) {
      const entry = undoStack.pop()!;
      idle[entry.person] -= entry.gapAdded;
      minutes[entry.person] -= entry.worked;
      lastEnd[entry.person] = entry.prevEnd;
    }
  }

  function record(cost: number) {
    const key = minutes.join(",");
    const existing = best.get(key);
    if (existing && existing.localCost <= cost) return;
    best.set(key, {
      perShift: chosen.map((c) => c.slice()),
      minutes: minutes.slice(),
      idle: idle.slice(),
      localCost: cost,
    });
  }

  function run(shiftIndex: number, cost: number) {
    if (shiftIndex === shifts.length) {
      record(cost);
      return;
    }
    const shift = shifts[shiftIndex];
    const elig = eligible[shiftIndex];
    const duration = shift.endMin - shift.startMin;

    outer: for (const mask of shiftMasks[shiftIndex]) {
      let applied = 0;
      let addedIdle = 0;
      const staff: number[] = [];

      for (let i = 0; i < elig.length; i++) {
        if ((mask & (1 << i)) === 0) continue;
        const p = elig[i];
        const prevEnd = lastEnd[p];
        let worked = duration;
        let gapAdded = 0;

        if (prevEnd >= 0) {
          // Two shifts may only be chained by the same person if they overlap by
          // at most the tolerated sliver (the same physical post) and the wait
          // between them is short enough.
          if (prevEnd - shift.startMin > maxOverlapMinutes) {
            rollback(applied);
            continue outer;
          }
          const gap = shift.startMin - prevEnd;
          if (gap > maxGapMinutes) {
            rollback(applied);
            continue outer;
          }
          if (gap > 0) gapAdded = gap;
          // Count real clock time, so an overlap is never paid twice.
          worked = Math.max(0, shift.endMin - Math.max(shift.startMin, prevEnd));
        }

        idle[p] += gapAdded;
        minutes[p] += worked;
        addedIdle += gapAdded;
        lastEnd[p] = Math.max(prevEnd, shift.endMin);
        undoStack.push({ person: p, prevEnd, worked, gapAdded });
        staff.push(p);
        applied++;
      }

      chosen[shiftIndex] = staff;
      run(
        shiftIndex + 1,
        cost +
          understaffCost(staff.length, shift, settings) +
          addedIdle * settings.weights.idleTime,
      );
      chosen[shiftIndex] = [];
      rollback(applied);
    }
  }

  run(0, 0);

  const patterns = [...best.values()].sort((a, b) => a.localCost - b.localCost);
  return { weekday, shifts, patterns };
}

function popcount(n: number): number {
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

/** Sum of squared deviations from the mean, in hours², across active people. */
function fairnessPenalty(totals: number[]): number {
  if (totals.length === 0) return 0;
  const hours = totals.map((m) => m / 60);
  const mean = hours.reduce((a, b) => a + b, 0) / hours.length;
  return hours.reduce((sum, h) => sum + (h - mean) ** 2, 0);
}

export function solve(input: SolveInput): SolveResult {
  const startedAt = Date.now();
  const settings = input.settings;

  const people = input.people.filter((p) => p.active);
  const shifts = input.shifts.filter((s) => s.active);
  const peopleCount = people.length;
  const personIndex = new Map(people.map((p, i) => [p.id, i]));

  const windowsByPerson = new Map<number, AvailabilityWindow[]>();
  for (const w of input.availability) {
    const list = windowsByPerson.get(w.personId);
    if (list) list.push(w);
    else windowsByPerson.set(w.personId, [w]);
  }

  // Pins referring to unavailable people (or unknown ids) are reported back to
  // the caller rather than silently honoured or silently dropped.
  const droppedPins: Assignment[] = [];
  const pinsByShift = new Map<number, number[]>();
  for (const pin of input.pins ?? []) {
    const shift = shifts.find((s) => s.id === pin.shiftId);
    const idx = personIndex.get(pin.personId);
    const windows = windowsByPerson.get(pin.personId) ?? [];
    if (!shift || idx === undefined || !isAvailable(shift, windows)) {
      droppedPins.push(pin);
      continue;
    }
    const list = pinsByShift.get(pin.shiftId);
    if (list) list.push(idx);
    else pinsByShift.set(pin.shiftId, [idx]);
  }

  // Build one plan per weekday that actually has shifts.
  const byWeekday = new Map<Weekday, Shift[]>();
  for (const shift of shifts) {
    const list = byWeekday.get(shift.weekday);
    if (list) list.push(shift);
    else byWeekday.set(shift.weekday, [shift]);
  }

  const plans: DayPlan[] = [];
  for (const [weekday, dayShifts] of [...byWeekday.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...dayShifts].sort(
      (a, b) => a.startMin - b.startMin || a.endMin - b.endMin || a.id - b.id,
    );
    const eligible = sorted.map((shift) =>
      people
        .map((p, i) => ({ i, windows: windowsByPerson.get(p.id) ?? [] }))
        .filter(({ windows }) => isAvailable(shift, windows))
        .map(({ i }) => i),
    );
    const pinnedPerShift = sorted.map((shift) => pinsByShift.get(shift.id) ?? []);
    plans.push(
      enumerateDay(weekday, sorted, eligible, pinnedPerShift, peopleCount, settings),
    );
  }

  // --- Phase 3: combine days with branch and bound -------------------------

  const dayCount = plans.length;
  // suffixMin[d] = cheapest achievable local cost for days d..end.
  const suffixMin = new Array<number>(dayCount + 1).fill(0);
  for (let d = dayCount - 1; d >= 0; d--) {
    const cheapest = plans[d].patterns[0]?.localCost ?? 0;
    suffixMin[d] = suffixMin[d + 1] + cheapest;
  }

  const maxDayOffBonus = peopleCount * settings.weights.dayOff;
  const totals = new Array<number>(peopleCount).fill(0);
  const chosenPatterns = new Array<DayPattern | null>(dayCount).fill(null);

  let bestCost = Number.POSITIVE_INFINITY;
  let bestChoice: DayPattern[] | null = null;
  let timedOut = false;

  function weeklyCost(localSum: number): number {
    let dayOffCount = 0;
    for (let p = 0; p < peopleCount; p++) {
      let daysWorked = 0;
      for (let d = 0; d < dayCount; d++) {
        if ((chosenPatterns[d]?.minutes[p] ?? 0) > 0) daysWorked++;
      }
      if (daysWorked < dayCount) dayOffCount++;
    }
    return (
      localSum +
      settings.weights.fairness * fairnessPenalty(totals) -
      settings.weights.dayOff * dayOffCount
    );
  }

  function search(day: number, localSum: number) {
    if (timedOut) return;
    if (Date.now() - startedAt > settings.maxSearchMs) {
      timedOut = true;
      return;
    }
    // Fairness is non-negative and the day-off bonus is bounded, so this is an
    // admissible lower bound on anything reachable from here.
    if (localSum + suffixMin[day] - maxDayOffBonus >= bestCost) return;

    if (day === dayCount) {
      const cost = weeklyCost(localSum);
      if (cost < bestCost) {
        bestCost = cost;
        bestChoice = chosenPatterns.map((p) => p!);
      }
      return;
    }

    for (const pattern of plans[day].patterns) {
      if (localSum + pattern.localCost + suffixMin[day + 1] - maxDayOffBonus >= bestCost) {
        // Patterns are sorted by localCost, so nothing later can pass either.
        break;
      }
      chosenPatterns[day] = pattern;
      for (let p = 0; p < peopleCount; p++) totals[p] += pattern.minutes[p];
      search(day + 1, localSum + pattern.localCost);
      for (let p = 0; p < peopleCount; p++) totals[p] -= pattern.minutes[p];
      chosenPatterns[day] = null;
    }
  }

  search(0, 0);

  // Fall back to the cheapest pattern per day if the bound pruned everything
  // (only reachable when the search timed out before its first leaf).
  const finalChoice: DayPattern[] =
    bestChoice ?? plans.map((plan) => plan.patterns[0]);

  // --- Materialise the result ---------------------------------------------

  const assignments: Assignment[] = [];
  const gaps: CoverageGap[] = [];
  const totalMinutes = new Array<number>(peopleCount).fill(0);
  const idleMinutes = new Array<number>(peopleCount).fill(0);
  const daysWorkedBy = new Map<number, Set<Weekday>>();

  const pinnedKeys = new Set(
    (input.pins ?? []).map((pin) => `${pin.shiftId}:${pin.personId}`),
  );

  for (let d = 0; d < plans.length; d++) {
    const plan = plans[d];
    const pattern = finalChoice[d];
    for (let s = 0; s < plan.shifts.length; s++) {
      const shift = plan.shifts[s];
      const staff = pattern.perShift[s];
      for (const idx of staff) {
        const person = people[idx];
        assignments.push({
          shiftId: shift.id,
          personId: person.id,
          pinned: pinnedKeys.has(`${shift.id}:${person.id}`),
        });
        const set = daysWorkedBy.get(person.id) ?? new Set<Weekday>();
        set.add(shift.weekday);
        daysWorkedBy.set(person.id, set);
      }
      if (staff.length < shift.requiredIdeal) {
        gaps.push({
          shiftId: shift.id,
          assigned: staff.length,
          requiredMin: shift.requiredMin,
          requiredIdeal: shift.requiredIdeal,
          critical: staff.length < shift.requiredMin,
        });
      }
    }
    for (let p = 0; p < peopleCount; p++) {
      totalMinutes[p] += pattern.minutes[p];
      idleMinutes[p] += pattern.idle[p];
    }
  }

  const workloads: PersonWorkload[] = people.map((person, i) => {
    const worked = daysWorkedBy.get(person.id) ?? new Set<Weekday>();
    const availableDays = new Set(
      (windowsByPerson.get(person.id) ?? []).map((w) => w.weekday),
    );
    return {
      personId: person.id,
      totalMinutes: totalMinutes[i],
      daysWorked: [...worked].sort((a, b) => a - b),
      daysOff: [...availableDays].filter((d) => !worked.has(d)).sort((a, b) => a - b),
      idleMinutes: idleMinutes[i],
    };
  });

  return {
    assignments,
    gaps,
    workloads,
    cost: bestChoice ? bestCost : Number.POSITIVE_INFINITY,
    optimal: !timedOut,
    elapsedMs: Date.now() - startedAt,
    droppedPins,
  };
}
