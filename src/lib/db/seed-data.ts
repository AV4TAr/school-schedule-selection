/**
 * The school's current roster and shift pattern, used to populate a fresh
 * database. Everything here is editable in the UI afterwards — this is only a
 * starting point, not hard-coded behaviour.
 */

import type { Preference, Weekday } from "../types";

const MON: Weekday = 1;
const TUE: Weekday = 2;
const WED: Weekday = 3;
const THU: Weekday = 4;
const FRI: Weekday = 5;

/** Minutes since midnight. */
const t = (h: number, m: number) => h * 60 + m;

/** Stand-in for "any time" — comfortably wider than the school day. */
const ALL_DAY: [number, number] = [t(7, 0), t(16, 0)];
const NINE_TO_END: [number, number] = [t(9, 0), t(13, 15)];

export interface SeedPerson {
  name: string;
  windows: {
    weekday: Weekday;
    startMin: number;
    endMin: number;
    preference?: Preference;
  }[];
}

export const SEED_PEOPLE: SeedPerson[] = [
  {
    name: "Jeanette",
    windows: [
      // Tuesdays only for the lunch shift; Fridays she is free all day.
      { weekday: TUE, startMin: t(11, 40), endMin: t(13, 15) },
      { weekday: FRI, startMin: ALL_DAY[0], endMin: ALL_DAY[1] },
    ],
  },
  {
    name: "Noriko",
    windows: [MON, TUE, WED, THU, FRI].map((weekday) => ({
      weekday,
      startMin: ALL_DAY[0],
      endMin: ALL_DAY[1],
    })),
  },
  {
    name: "Heather",
    windows: [TUE, WED, THU].map((weekday) => ({
      weekday,
      startMin: NINE_TO_END[0],
      endMin: NINE_TO_END[1],
    })),
  },
  {
    name: "Teresa",
    windows: [MON, TUE, WED, THU, FRI].map((weekday) => ({
      weekday,
      startMin: NINE_TO_END[0],
      endMin: NINE_TO_END[1],
    })),
  },
];

export interface SeedShift {
  name: string;
  weekdays: Weekday[];
  startMin: number;
  endMin: number;
  requiredMin: number;
  requiredIdeal: number;
}

export const SEED_SHIFTS: SeedShift[] = [
  {
    name: "Arrival",
    weekdays: [MON, TUE, THU, FRI],
    startMin: t(8, 0),
    endMin: t(8, 45),
    requiredMin: 1,
    requiredIdeal: 2,
  },
  {
    // Overlaps Arrival by five minutes: it is the same post, so one person can
    // cover both back to back.
    name: "Early supervision",
    weekdays: [MON, TUE, THU, FRI],
    startMin: t(8, 40),
    endMin: t(9, 20),
    requiredMin: 1,
    requiredIdeal: 1,
  },
  {
    name: "Recess",
    weekdays: [MON, TUE, WED, THU, FRI],
    startMin: t(10, 5),
    endMin: t(11, 40),
    requiredMin: 1,
    requiredIdeal: 1,
  },
  {
    // Three is a genuine requirement, not a preference, so it is the hard floor
    // too. Mondays can only ever reach two people and will show as a critical
    // gap — that warning is the point.
    name: "Lunch",
    weekdays: [MON, TUE, WED, THU, FRI],
    startMin: t(11, 40),
    endMin: t(13, 15),
    requiredMin: 3,
    requiredIdeal: 3,
  },
];
