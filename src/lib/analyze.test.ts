import { describe, expect, it } from "vitest";

import { analyzeSchedule } from "./analyze";
import { coveringWindow, isAvailable, preferenceFor } from "./availability";
import {
  DEFAULT_SETTINGS,
  type Assignment,
  type AvailabilityWindow,
  type Person,
  type Preference,
  type Shift,
} from "./types";

const t = (h: number, m = 0) => h * 60 + m;

const person = (id: number, name: string): Person => ({ id, name, active: true });

const window_ = (
  id: number,
  personId: number,
  weekday: number,
  startMin: number,
  endMin: number,
  preference: Preference = "neutral",
): AvailabilityWindow =>
  ({ id, personId, weekday, startMin, endMin, preference }) as AvailabilityWindow;

const shift = (
  id: number,
  name: string,
  weekday: number,
  startMin: number,
  endMin: number,
  requiredMin = 1,
  requiredIdeal = 1,
): Shift =>
  ({ id, name, weekday, startMin, endMin, requiredMin, requiredIdeal, active: true }) as Shift;

const assign = (shiftId: number, personId: number): Assignment => ({
  shiftId,
  personId,
  pinned: false,
});

describe("availability rule", () => {
  const morning = window_(1, 1, 1, t(8), t(12));

  it("requires one window to cover the shift end to end", () => {
    expect(isAvailable(shift(1, "a", 1, t(9), t(10)), [morning])).toBe(true);
    expect(isAvailable(shift(1, "a", 1, t(11), t(13)), [morning])).toBe(false);
  });

  it("does not combine two adjacent windows", () => {
    const split = [window_(1, 1, 1, t(8), t(10)), window_(2, 1, 1, t(10), t(12))];
    expect(isAvailable(shift(1, "a", 1, t(9), t(11)), split)).toBe(false);
  });

  it("ignores windows on other weekdays", () => {
    expect(isAvailable(shift(1, "a", 2, t(9), t(10)), [morning])).toBe(false);
  });

  it("picks the most positive window when several cover the shift", () => {
    const windows = [
      window_(1, 1, 1, t(8), t(12), "avoid"),
      window_(2, 1, 1, t(8), t(12), "preferred"),
      window_(3, 1, 1, t(8), t(12), "neutral"),
    ];
    expect(coveringWindow(shift(1, "a", 1, t(9), t(10)), windows)?.preference).toBe(
      "preferred",
    );
  });

  it("reports neutral when the person is not available at all", () => {
    expect(preferenceFor(shift(1, "a", 3, t(9), t(10)), [morning])).toBe("neutral");
  });
});

describe("analyzeSchedule", () => {
  const people = [person(1, "Ana"), person(2, "Bea")];

  it("flags a wait longer than the configured maximum", () => {
    // 8:00–9:00 then 11:00–12:00 leaves a two-hour gap.
    const shifts = [shift(1, "early", 1, t(8), t(9)), shift(2, "late", 1, t(11), t(12))];
    const windows = [window_(1, 1, 1, t(7), t(13))];
    const result = analyzeSchedule(
      people,
      shifts,
      [assign(1, 1), assign(2, 1)],
      windows,
      DEFAULT_SETTINGS,
    );

    expect(result.violations).toEqual([
      { kind: "gap", personId: 1, weekday: 1, minutes: 120 },
    ]);
  });

  it("accepts a wait exactly at the maximum", () => {
    // The real schedule leans on this: 9:20 to 10:05 is exactly 45 minutes.
    const shifts = [
      shift(1, "early", 1, t(8, 40), t(9, 20)),
      shift(2, "late", 1, t(10, 5), t(11, 40)),
    ];
    const result = analyzeSchedule(
      people,
      shifts,
      [assign(1, 1), assign(2, 1)],
      [window_(1, 1, 1, t(7), t(13))],
      DEFAULT_SETTINGS,
    );
    expect(result.violations).toEqual([]);
  });

  it("tolerates a small overlap but flags a large one", () => {
    const windows = [window_(1, 1, 1, t(7), t(13))];

    const small = analyzeSchedule(
      people,
      [shift(1, "a", 1, t(8), t(8, 45)), shift(2, "b", 1, t(8, 40), t(9, 20))],
      [assign(1, 1), assign(2, 1)],
      windows,
      DEFAULT_SETTINGS,
    );
    expect(small.violations).toEqual([]);

    const big = analyzeSchedule(
      people,
      [shift(1, "a", 1, t(8), t(10)), shift(2, "b", 1, t(9), t(11))],
      [assign(1, 1), assign(2, 1)],
      windows,
      DEFAULT_SETTINGS,
    );
    expect(big.violations).toEqual([
      { kind: "overlap", personId: 1, weekday: 1, minutes: 60 },
    ]);
  });

  it("counts overlapping shifts as wall-clock time, not twice", () => {
    const result = analyzeSchedule(
      people,
      [shift(1, "a", 1, t(8), t(8, 45)), shift(2, "b", 1, t(8, 40), t(9, 20))],
      [assign(1, 1), assign(2, 1)],
      [window_(1, 1, 1, t(7), t(13))],
      DEFAULT_SETTINGS,
    );
    // 8:00 to 9:20 is 80 minutes, not 45 + 40.
    expect(result.workloads.find((w) => w.personId === 1)!.totalMinutes).toBe(80);
  });

  it("flags an assignment that no longer fits availability", () => {
    const result = analyzeSchedule(
      people,
      [shift(1, "a", 1, t(8), t(9))],
      [assign(1, 2)],
      [window_(1, 1, 1, t(7), t(13))],
      DEFAULT_SETTINGS,
    );
    expect(result.conflicts).toEqual([assign(1, 2)]);
  });

  it("separates a critical shortfall from merely missing the preferred count", () => {
    const shifts = [shift(1, "a", 1, t(8), t(9), 2, 3)];
    const result = analyzeSchedule(
      people,
      shifts,
      [assign(1, 1), assign(1, 2)],
      [window_(1, 1, 1, t(7), t(13)), window_(2, 2, 1, t(7), t(13))],
      DEFAULT_SETTINGS,
    );
    expect(result.gaps).toEqual([
      { shiftId: 1, assigned: 2, requiredMin: 2, requiredIdeal: 3, critical: false },
    ]);
  });

  it("tracks preferred and disliked minutes worked", () => {
    const result = analyzeSchedule(
      people,
      [shift(1, "a", 1, t(8), t(9)), shift(2, "b", 1, t(9), t(10))],
      [assign(1, 1), assign(2, 1)],
      [
        window_(1, 1, 1, t(8), t(9), "preferred"),
        window_(2, 1, 1, t(9), t(10), "avoid"),
      ],
      DEFAULT_SETTINGS,
    );
    const ana = result.workloads.find((w) => w.personId === 1)!;
    expect(ana.preferredMinutes).toBe(60);
    expect(ana.avoidedMinutes).toBe(60);
  });
});
