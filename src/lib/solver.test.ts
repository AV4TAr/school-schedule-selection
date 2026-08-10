import { describe, expect, it } from "vitest";

import { SEED_PEOPLE, SEED_SHIFTS } from "./db/seed-data";
import { solve, type SolveInput } from "./solver";
import {
  DEFAULT_SETTINGS,
  type AvailabilityWindow,
  type Person,
  type Shift,
} from "./types";

/** Turn the seed fixtures into solver input, mirroring what the DB layer does. */
function buildInput(overrides: Partial<SolveInput> = {}): SolveInput {
  const people: Person[] = SEED_PEOPLE.map((p, i) => ({
    id: i + 1,
    name: p.name,
    active: true,
  }));

  const windows: AvailabilityWindow[] = [];
  SEED_PEOPLE.forEach((p, i) => {
    for (const w of p.windows) {
      windows.push({
        id: windows.length + 1,
        personId: i + 1,
        preference: "neutral",
        ...w,
      });
    }
  });

  const shifts: Shift[] = [];
  for (const s of SEED_SHIFTS) {
    for (const weekday of s.weekdays) {
      shifts.push({
        id: shifts.length + 1,
        name: s.name,
        weekday,
        startMin: s.startMin,
        endMin: s.endMin,
        requiredMin: s.requiredMin,
        requiredIdeal: s.requiredIdeal,
        active: true,
      });
    }
  }

  return { people, availability: windows, shifts, settings: DEFAULT_SETTINGS, ...overrides };
}

const byName = (input: SolveInput, name: string) =>
  input.people.find((p) => p.name === name)!.id;

const shiftOf = (input: SolveInput, name: string, weekday: number) =>
  input.shifts.find((s) => s.name === name && s.weekday === weekday)!;

describe("solver", () => {
  const input = buildInput();
  const result = solve(input);

  it("finishes fast and proves optimality", () => {
    expect(result.optimal).toBe(true);
    expect(result.elapsedMs).toBeLessThan(DEFAULT_SETTINGS.maxSearchMs);
  });

  it("only assigns people inside their availability windows", () => {
    for (const a of result.assignments) {
      const shift = input.shifts.find((s) => s.id === a.shiftId)!;
      const windows = input.availability.filter((w) => w.personId === a.personId);
      const covered = windows.some(
        (w) =>
          w.weekday === shift.weekday &&
          w.startMin <= shift.startMin &&
          w.endMin >= shift.endMin,
      );
      expect(covered, `person ${a.personId} on shift ${a.shiftId}`).toBe(true);
    }
  });

  it("never leaves anyone waiting more than the max gap", () => {
    for (const person of input.people) {
      for (const weekday of [1, 2, 3, 4, 5]) {
        const worked = result.assignments
          .filter((a) => a.personId === person.id)
          .map((a) => input.shifts.find((s) => s.id === a.shiftId)!)
          .filter((s) => s.weekday === weekday)
          .sort((a, b) => a.startMin - b.startMin);

        for (let i = 1; i < worked.length; i++) {
          const gap = worked[i].startMin - worked[i - 1].endMin;
          expect(gap, `${person.name} day ${weekday}`).toBeLessThanOrEqual(
            DEFAULT_SETTINGS.maxGapMinutes,
          );
          // Chaining is only legal across the tolerated overlap.
          expect(-gap).toBeLessThanOrEqual(DEFAULT_SETTINGS.maxOverlapMinutes);
        }
      }
    }
  });

  it("never staffs a shift above its ideal headcount", () => {
    for (const shift of input.shifts) {
      const count = result.assignments.filter((a) => a.shiftId === shift.id).length;
      expect(count).toBeLessThanOrEqual(shift.requiredIdeal);
    }
  });

  it("reports Monday lunch as the one and only critical gap", () => {
    const monday = shiftOf(input, "Lunch", 1);
    expect(result.gaps.filter((g) => g.critical)).toEqual([
      {
        shiftId: monday.id,
        assigned: 2,
        requiredMin: 3,
        requiredIdeal: 3,
        critical: true,
      },
    ]);
  });

  it("staffs Monday lunch with only two people, because only two exist", () => {
    const monday = shiftOf(input, "Lunch", 1);
    const staff = result.assignments.filter((a) => a.shiftId === monday.id);
    const names = staff
      .map((a) => input.people.find((p) => p.id === a.personId)!.name)
      .sort();
    expect(names).toEqual(["Noriko", "Teresa"]);
  });

  it("cannot reach two people on Friday arrival", () => {
    // Friday lunch needs all three available people, and the only two who can
    // work at 8am are among them. Whoever takes the second arrival slot has no
    // legal way to bridge the morning, so arrival tops out at one.
    const friday = shiftOf(input, "Arrival", 5);
    const count = result.assignments.filter((a) => a.shiftId === friday.id).length;
    expect(count).toBe(1);
    expect(result.gaps).toContainEqual({
      shiftId: friday.id,
      assigned: 1,
      requiredMin: 1,
      requiredIdeal: 2,
      critical: false,
    });
  });

  it("fills every other lunch shift with three people", () => {
    for (const weekday of [2, 3, 4, 5]) {
      const shift = shiftOf(input, "Lunch", weekday);
      const count = result.assignments.filter((a) => a.shiftId === shift.id).length;
      expect(count, `lunch on weekday ${weekday}`).toBe(3);
    }
  });

  it("covers every recess and early-supervision shift", () => {
    for (const shift of input.shifts) {
      if (shift.name !== "Recess" && shift.name !== "Early supervision") continue;
      const count = result.assignments.filter((a) => a.shiftId === shift.id).length;
      expect(count, `${shift.name} weekday ${shift.weekday}`).toBe(1);
    }
  });

  it("gives Noriko every pre-9am shift, since nobody else can be there", () => {
    const noriko = byName(input, "Noriko");
    for (const weekday of [1, 2, 4]) {
      for (const name of ["Arrival", "Early supervision"]) {
        const shift = shiftOf(input, name, weekday);
        const staff = result.assignments.filter((a) => a.shiftId === shift.id);
        expect(staff.map((a) => a.personId), `${name} weekday ${weekday}`).toEqual([
          noriko,
        ]);
      }
    }
  });

  it("leaves Noriko the most loaded and Jeanette the least", () => {
    const hours = Object.fromEntries(
      result.workloads.map((w) => [
        input.people.find((p) => p.id === w.personId)!.name,
        w.totalMinutes / 60,
      ]),
    );

    const sorted = Object.entries(hours).sort((a, b) => b[1] - a[1]);
    expect(sorted[0][0]).toBe("Noriko");
    expect(sorted.at(-1)![0]).toBe("Jeanette");

    // Structural floor from the hand analysis: Noriko is the only person who can
    // open Mon/Tue/Thu, and the gap rule then forces her to stay all morning.
    expect(hours.Noriko).toBeGreaterThanOrEqual(13);
    expect(hours.Jeanette).toBeLessThanOrEqual(6.5);
  });

  it("honours a pinned assignment", () => {
    const jeanette = byName(input, "Jeanette");
    const fridayRecess = shiftOf(input, "Recess", 5);
    const pinned = solve(
      buildInput({ pins: [{ shiftId: fridayRecess.id, personId: jeanette, pinned: true }] }),
    );

    expect(pinned.droppedPins).toEqual([]);
    expect(
      pinned.assignments.some(
        (a) => a.shiftId === fridayRecess.id && a.personId === jeanette,
      ),
    ).toBe(true);
  });

  it("reports a pin that contradicts availability instead of honouring it", () => {
    const heather = byName(input, "Heather");
    const mondayLunch = shiftOf(input, "Lunch", 1);
    const pinned = solve(
      buildInput({ pins: [{ shiftId: mondayLunch.id, personId: heather, pinned: true }] }),
    );

    expect(pinned.droppedPins).toHaveLength(1);
    expect(
      pinned.assignments.some(
        (a) => a.shiftId === mondayLunch.id && a.personId === heather,
      ),
    ).toBe(false);
  });

  it("prefers the person who wants the hours when the choice is otherwise free", () => {
    // Wednesday recess needs one person and Heather, Teresa and Noriko can all
    // do it. Marking it preferred for Heather should settle the tie.
    const base = buildInput();
    const heather = byName(base, "Heather");
    const wedRecess = shiftOf(base, "Recess", 3);

    const keen = base.availability.map((w) =>
      w.personId === heather && w.weekday === 3
        ? { ...w, preference: "preferred" as const }
        : w,
    );
    const after = solve({ ...base, availability: keen });

    expect(
      after.assignments.some(
        (a) => a.shiftId === wedRecess.id && a.personId === heather,
      ),
    ).toBe(true);
    expect(
      after.workloads.find((w) => w.personId === heather)!.preferredMinutes,
    ).toBeGreaterThan(0);
  });

  it("steers away from hours someone would rather avoid", () => {
    // Split Heather's Wednesday into two windows so the recess slot alone is
    // marked "avoid" — preferences attach to a window, not to a slice of one.
    const base = buildInput();
    const heather = byName(base, "Heather");
    const wedRecess = shiftOf(base, "Recess", 3);

    const split = base.availability.flatMap((w) =>
      w.personId === heather && w.weekday === 3
        ? [
            { ...w, endMin: 11 * 60 + 40, preference: "avoid" as const },
            { ...w, id: w.id + 1000, startMin: 11 * 60 + 40 },
          ]
        : [w],
    );
    const after = solve({ ...base, availability: split });

    expect(
      after.assignments.some(
        (a) => a.shiftId === wedRecess.id && a.personId === heather,
      ),
    ).toBe(false);
    expect(
      after.workloads.find((w) => w.personId === heather)!.avoidedMinutes,
    ).toBe(0);
  });

  it("does not let a preference wreck the balance of hours", () => {
    // Teresa disliking Tuesdays is not enough to justify moving her share onto
    // Noriko, who is already the most loaded. Preferences are a tie-breaker,
    // not a veto — this is the behaviour that keeps them from backfiring.
    const base = buildInput();
    const teresa = byName(base, "Teresa");
    const reluctant = base.availability.map((w) =>
      w.personId === teresa && w.weekday === 2
        ? { ...w, preference: "avoid" as const }
        : w,
    );
    const after = solve({ ...base, availability: reluctant });

    expect(after.workloads.find((w) => w.personId === teresa)!.daysWorked).toContain(2);
    const noriko = byName(base, "Noriko");
    expect(
      after.workloads.find((w) => w.personId === noriko)!.totalMinutes,
    ).toBe(solve(base).workloads.find((w) => w.personId === noriko)!.totalMinutes);
  });

  it("never lets a preference override coverage", () => {
    // Noriko is the only person who can open. Even if she hates every minute of
    // it, the shifts still have to be covered.
    const base = buildInput();
    const noriko = byName(base, "Noriko");
    const reluctant = base.availability.map((w) =>
      w.personId === noriko ? { ...w, preference: "avoid" as const } : w,
    );
    const after = solve({ ...base, availability: reluctant });

    for (const weekday of [1, 2, 4]) {
      const shift = shiftOf(base, "Arrival", weekday);
      expect(
        after.assignments.map((a) => a.shiftId),
        `arrival weekday ${weekday}`,
      ).toContain(shift.id);
    }
    // Same critical gaps as before: preferences changed nothing structural.
    expect(after.gaps.filter((g) => g.critical)).toHaveLength(1);
  });

  it("treats a preference as soft and never as permission", () => {
    // An "avoid" window is still a window: the person remains schedulable.
    const base = buildInput();
    const all = base.availability.map((w) => ({ ...w, preference: "avoid" as const }));
    const after = solve({ ...base, availability: all });
    expect(after.assignments.length).toBe(solve(base).assignments.length);
  });

  it("rebalances when one more person can open on Mondays", () => {
    // The what-if the school actually cares about: give Teresa an 8am Monday
    // start and the load should shift off Noriko.
    const base = buildInput();
    const teresa = byName(base, "Teresa");
    const widened = base.availability.map((w) =>
      w.personId === teresa && w.weekday === 1 ? { ...w, startMin: 8 * 60 } : w,
    );
    const after = solve({ ...base, availability: widened });

    const norikoBefore = result.workloads.find(
      (w) => w.personId === byName(base, "Noriko"),
    )!.totalMinutes;
    const norikoAfter = after.workloads.find(
      (w) => w.personId === byName(base, "Noriko"),
    )!.totalMinutes;

    expect(norikoAfter).toBeLessThan(norikoBefore);
  });
});
