/**
 * Core domain types.
 *
 * All times are stored as "minutes since midnight" integers (e.g. 8:40 => 520).
 * This keeps the whole app free of timezone and date arithmetic: a schedule is a
 * recurring weekly template, not a set of calendar events.
 */

/** 1 = Monday ... 7 = Sunday (ISO-8601 weekday numbering). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
/** The days the school actually operates; used to order grids and seed data. */
export const SCHOOL_WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

export interface Person {
  id: number;
  name: string;
  /** Inactive people keep their history but are ignored by the solver. */
  active: boolean;
}

/**
 * How willing someone is to work a stretch of time. This is deliberately only
 * about *soft* feeling: being unable to work is expressed by having no window
 * at all, so a preference can never be traded away into an impossible shift.
 */
export type Preference = "preferred" | "neutral" | "avoid";

export const PREFERENCES: Preference[] = ["preferred", "neutral", "avoid"];

/**
 * One continuous window a person can work on a given weekday. A person may have
 * several windows per day (e.g. early morning and afternoon with a break), and
 * each carries its own preference.
 */
export interface AvailabilityWindow {
  id: number;
  personId: number;
  weekday: Weekday;
  startMin: number;
  endMin: number;
  preference: Preference;
}

export interface Shift {
  id: number;
  name: string;
  weekday: Weekday;
  startMin: number;
  endMin: number;
  /** Below this headcount the shift is considered critically understaffed. */
  requiredMin: number;
  /** The headcount we actually want. Never staffed above this. */
  requiredIdeal: number;
  active: boolean;
}

export interface Assignment {
  shiftId: number;
  personId: number;
  /**
   * Pinned assignments are locked by the user: the solver must honour them and
   * optimises the rest of the week around them.
   */
  pinned: boolean;
}

export interface SolverWeights {
  /** Per person-slot missing below `requiredMin`. Dominates everything else. */
  understaffCritical: number;
  /** Per person-slot missing between `requiredMin` and `requiredIdeal`. */
  understaffIdeal: number;
  /** Applied to the variance of weekly minutes across people. */
  fairness: number;
  /** Per minute a person spends waiting between two of their own shifts. */
  idleTime: number;
  /** Bonus (negative cost) per person who gets a full day off. */
  dayOff: number;
  /** Bonus per minute worked inside a window the person marked "preferred". */
  preferred: number;
  /** Cost per minute worked inside a window the person marked "avoid". */
  avoid: number;
}

export interface SolverSettings {
  /** Max minutes a person may wait between two consecutive shifts. */
  maxGapMinutes: number;
  /**
   * Two shifts overlapping by at most this many minutes can still be worked
   * back to back by the same person (they are the same physical post).
   */
  maxOverlapMinutes: number;
  weights: SolverWeights;
  /** Safety valve so the search can never hang the UI. */
  maxSearchMs: number;
}

/**
 * Weights are tiered so the priorities can never invert: no amount of fairness
 * or convenience is allowed to buy away a body on a critically short shift.
 * Fairness is measured in hours², so a person 5h off the mean contributes ~25.
 */
export const DEFAULT_WEIGHTS: SolverWeights = {
  understaffCritical: 1_000_000,
  understaffIdeal: 100_000,
  fairness: 100,
  idleTime: 25,
  dayOff: 400,
  // Per minute, so a 95-minute shift is worth ~475 either way: enough to steer
  // a genuine choice, far too small to outrank coverage.
  preferred: 5,
  avoid: 8,
};

export const DEFAULT_SETTINGS: SolverSettings = {
  maxGapMinutes: 45,
  maxOverlapMinutes: 5,
  weights: DEFAULT_WEIGHTS,
  maxSearchMs: 5_000,
};

/** A shift that could not be staffed to its ideal headcount. */
export interface CoverageGap {
  shiftId: number;
  assigned: number;
  requiredMin: number;
  requiredIdeal: number;
  /** True when the shift is below `requiredMin`, not merely below ideal. */
  critical: boolean;
}

export interface PersonWorkload {
  personId: number;
  totalMinutes: number;
  /** Weekdays on which this person has at least one shift. */
  daysWorked: Weekday[];
  /** Weekdays where they are available but assigned nothing. */
  daysOff: Weekday[];
  /** Minutes spent waiting between shifts. */
  idleMinutes: number;
  /** Minutes worked inside windows the person marked "preferred". */
  preferredMinutes: number;
  /** Minutes worked inside windows the person marked "avoid". */
  avoidedMinutes: number;
}

export interface SolveResult {
  assignments: Assignment[];
  gaps: CoverageGap[];
  workloads: PersonWorkload[];
  cost: number;
  /** False when the search hit `maxSearchMs` before exhausting the space. */
  optimal: boolean;
  elapsedMs: number;
  /** Pins that were discarded because the person is not available then. */
  droppedPins: Assignment[];
}
