"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { assignments, availability, people, shifts } from "@/lib/db/schema";
import {
  getAssignments,
  getAvailability,
  getPeople,
  getShifts,
  getSolverSettings,
  saveSolverSettings,
} from "@/lib/db/queries";
import { popUndo, pushUndo, type UndoLabel } from "@/lib/db/undo";
import { isAvailable } from "@/lib/availability";
import { requireAdmin } from "@/lib/session";
import { solve } from "@/lib/solver";
import { SCHOOL_WEEKDAYS, type Preference, type SolverSettings, type Weekday } from "@/lib/types";

/**
 * Every action here takes the `scheduleId` it operates on and begins with
 * `requireAdmin`, which checks the signed per-schedule cookie server-side. The
 * id being a plain argument is safe precisely because the cookie — not the
 * argument — decides whether the caller may write to that schedule.
 */

function refresh() {
  revalidatePath("/", "layout");
}

/** Look up a name for the undo label before the row is changed or removed. */
function personName(scheduleId: number, id: number): string {
  return (
    db
      .select()
      .from(people)
      .where(and(eq(people.id, id), eq(people.scheduleId, scheduleId)))
      .get()?.name ?? "?"
  );
}

function shiftName(scheduleId: number, id: number): string {
  return (
    db
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, id), eq(shifts.scheduleId, scheduleId)))
      .get()?.name ?? "?"
  );
}

/** Rows are only ever addressed together with their schedule, never by id alone. */
const ownedShift = (scheduleId: number, id: number) =>
  and(eq(shifts.id, id), eq(shifts.scheduleId, scheduleId));
const ownedPerson = (scheduleId: number, id: number) =>
  and(eq(people.id, id), eq(people.scheduleId, scheduleId));
const ownedWindow = (scheduleId: number, id: number) =>
  and(eq(availability.id, id), eq(availability.scheduleId, scheduleId));

// --- Undo -----------------------------------------------------------------

/** Reverse the most recent action. Deliberately not itself undoable. */
export async function undoLast(scheduleId: number) {
  await requireAdmin(scheduleId);
  const label = popUndo(scheduleId);
  refresh();
  return label;
}

// --- Schedule -------------------------------------------------------------

/**
 * Re-solve the week and replace the stored assignments. Pinned assignments are
 * fed back in as constraints so the user's manual locks survive.
 */
export async function generateSchedule(scheduleId: number) {
  await requireAdmin(scheduleId);
  pushUndo(scheduleId, { key: "generate" });

  const pins = getAssignments(scheduleId).filter((a) => a.pinned);
  const result = solve({
    people: getPeople(scheduleId),
    availability: getAvailability(scheduleId),
    shifts: getShifts(scheduleId),
    pins,
    settings: getSolverSettings(scheduleId),
  });

  db.transaction((tx) => {
    tx.delete(assignments).where(eq(assignments.scheduleId, scheduleId)).run();
    for (const a of result.assignments) {
      tx.insert(assignments)
        .values({
          scheduleId,
          shiftId: a.shiftId,
          personId: a.personId,
          pinned: a.pinned,
        })
        .run();
    }
  });

  refresh();
  return {
    optimal: result.optimal,
    elapsedMs: result.elapsedMs,
    droppedPins: result.droppedPins.length,
  };
}

export async function togglePin(scheduleId: number, shiftId: number, personId: number) {
  await requireAdmin(scheduleId);
  const row = db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.scheduleId, scheduleId),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .get();
  if (!row) return;

  pushUndo(scheduleId, {
    key: row.pinned ? "unpin" : "pin",
    params: { person: personName(scheduleId, personId), shift: shiftName(scheduleId, shiftId) },
  });

  db.update(assignments).set({ pinned: !row.pinned }).where(eq(assignments.id, row.id)).run();
  refresh();
}

/**
 * Manually place someone on a shift. Manual placements are pinned by default:
 * the user just made a decision, and the next Generate must not silently
 * discard it. Refuses people who are not available — that is a hard rule.
 */
export async function addAssignment(scheduleId: number, shiftId: number, personId: number) {
  await requireAdmin(scheduleId);

  const shift = db.select().from(shifts).where(ownedShift(scheduleId, shiftId)).get();
  if (!shift) return;
  // Guards against a person id from another schedule being smuggled in.
  const person = db.select().from(people).where(ownedPerson(scheduleId, personId)).get();
  if (!person) return;

  const windows = getAvailability(scheduleId).filter((w) => w.personId === personId);
  if (!isAvailable({ ...shift, weekday: shift.weekday as Weekday }, windows)) return;

  const existing = db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.scheduleId, scheduleId),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .get();
  if (existing) return;

  pushUndo(scheduleId, {
    key: "addAssignment",
    params: { person: person.name, shift: shift.name },
  });
  db.insert(assignments).values({ scheduleId, shiftId, personId, pinned: true }).run();
  refresh();
}

export async function removeAssignment(scheduleId: number, shiftId: number, personId: number) {
  await requireAdmin(scheduleId);
  pushUndo(scheduleId, {
    key: "removeAssignment",
    params: { person: personName(scheduleId, personId), shift: shiftName(scheduleId, shiftId) },
  });
  db.delete(assignments)
    .where(
      and(
        eq(assignments.scheduleId, scheduleId),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .run();
  refresh();
}

export async function clearPins(scheduleId: number) {
  await requireAdmin(scheduleId);
  pushUndo(scheduleId, { key: "clearPins" });
  db.update(assignments)
    .set({ pinned: false })
    .where(eq(assignments.scheduleId, scheduleId))
    .run();
  refresh();
}

// --- Staff ----------------------------------------------------------------

export async function createPerson(scheduleId: number, name: string) {
  await requireAdmin(scheduleId);
  const trimmed = name.trim();
  if (!trimmed) return;
  pushUndo(scheduleId, { key: "addPerson", params: { person: trimmed } });
  db.insert(people).values({ scheduleId, name: trimmed }).run();
  refresh();
}

export async function updatePerson(
  scheduleId: number,
  id: number,
  patch: { name?: string; active?: boolean },
) {
  await requireAdmin(scheduleId);
  const set: { name?: string; active?: boolean } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return;
    set.name = trimmed;
  }
  if (patch.active !== undefined) set.active = patch.active;
  if (Object.keys(set).length === 0) return;

  pushUndo(scheduleId, { key: "editPerson", params: { person: personName(scheduleId, id) } });
  db.update(people).set(set).where(ownedPerson(scheduleId, id)).run();
  refresh();
}

export async function deletePerson(scheduleId: number, id: number) {
  await requireAdmin(scheduleId);
  pushUndo(scheduleId, { key: "deletePerson", params: { person: personName(scheduleId, id) } });
  db.delete(people).where(ownedPerson(scheduleId, id)).run();
  refresh();
}

export async function createAvailability(
  scheduleId: number,
  personId: number,
  weekday: Weekday,
  startMin: number,
  endMin: number,
  preference: Preference = "neutral",
) {
  await requireAdmin(scheduleId);
  if (endMin <= startMin) return;
  const person = db.select().from(people).where(ownedPerson(scheduleId, personId)).get();
  if (!person) return;

  pushUndo(scheduleId, { key: "addWindow", params: { person: person.name } });
  db.insert(availability)
    .values({ scheduleId, personId, weekday, startMin, endMin, preference })
    .run();
  refresh();
}

export async function updateAvailability(
  scheduleId: number,
  id: number,
  patch: {
    weekday?: Weekday;
    startMin?: number;
    endMin?: number;
    preference?: Preference;
  },
) {
  await requireAdmin(scheduleId);
  const row = db.select().from(availability).where(ownedWindow(scheduleId, id)).get();
  if (!row) return;
  const next = { ...row, ...patch };
  if (next.endMin <= next.startMin) return;

  pushUndo(scheduleId, {
    key: "editWindow",
    params: { person: personName(scheduleId, row.personId) },
  });
  db.update(availability)
    .set({
      weekday: next.weekday,
      startMin: next.startMin,
      endMin: next.endMin,
      preference: next.preference,
    })
    .where(ownedWindow(scheduleId, id))
    .run();
  refresh();
}

export async function deleteAvailability(scheduleId: number, id: number) {
  await requireAdmin(scheduleId);
  const row = db.select().from(availability).where(ownedWindow(scheduleId, id)).get();
  if (!row) return;
  pushUndo(scheduleId, {
    key: "deleteWindow",
    params: { person: personName(scheduleId, row.personId) },
  });
  db.delete(availability).where(ownedWindow(scheduleId, id)).run();
  refresh();
}

// --- Shifts ---------------------------------------------------------------

export interface ShiftInput {
  name: string;
  weekday: Weekday;
  startMin: number;
  endMin: number;
  requiredMin: number;
  requiredIdeal: number;
  active?: boolean;
}

function normaliseShift(input: ShiftInput): ShiftInput | null {
  const name = input.name.trim();
  if (!name) return null;
  if (input.endMin <= input.startMin) return null;
  const requiredMin = Math.max(0, Math.round(input.requiredMin));
  const requiredIdeal = Math.max(requiredMin, Math.round(input.requiredIdeal));
  return { ...input, name, requiredMin, requiredIdeal };
}

export async function createShift(scheduleId: number, input: ShiftInput) {
  await requireAdmin(scheduleId);
  const clean = normaliseShift(input);
  if (!clean) return;
  pushUndo(scheduleId, { key: "addShift", params: { shift: clean.name } });
  db.insert(shifts).values({ scheduleId, ...clean, active: clean.active ?? true }).run();
  refresh();
}

/**
 * The Shifts screen groups the same slot across weekdays into one row, so these
 * operate on a whole group at once. `ids` is every shift in the group.
 */
export async function updateShiftGroup(
  scheduleId: number,
  ids: number[],
  input: Omit<ShiftInput, "weekday">,
) {
  await requireAdmin(scheduleId);
  if (ids.length === 0) return;
  const clean = normaliseShift({ ...input, weekday: 1 });
  if (!clean) return;

  pushUndo(scheduleId, { key: "editShift", params: { shift: shiftName(scheduleId, ids[0]) } });
  db.transaction((tx) => {
    for (const id of ids) {
      tx.update(shifts)
        .set({
          name: clean.name,
          startMin: clean.startMin,
          endMin: clean.endMin,
          requiredMin: clean.requiredMin,
          requiredIdeal: clean.requiredIdeal,
          active: clean.active ?? true,
        })
        .where(ownedShift(scheduleId, id))
        .run();
    }
  });
  refresh();
}

/**
 * Turn one weekday of a shift *segment* (a name + specific time range) on or
 * off. A shift name can have several segments, but a given weekday can only
 * belong to ONE of them — enabling a day here first removes it from any other
 * segment sharing the same name, so segments can never overlap.
 */
export async function setShiftWeekday(
  scheduleId: number,
  ids: number[],
  weekday: Weekday,
  enabled: boolean,
) {
  await requireAdmin(scheduleId);
  if (ids.length === 0) return;
  const template = db.select().from(shifts).where(ownedShift(scheduleId, ids[0])).get();
  if (!template) return;

  const sameNameShifts = db
    .select()
    .from(shifts)
    .where(and(eq(shifts.scheduleId, scheduleId), eq(shifts.name, template.name)))
    .all();

  const existingHere = sameNameShifts.find(
    (s) =>
      s.weekday === weekday &&
      s.startMin === template.startMin &&
      s.endMin === template.endMin,
  );

  if (enabled) {
    if (existingHere) return;

    const claimedElsewhere = sameNameShifts.filter(
      (s) =>
        s.weekday === weekday &&
        !(s.startMin === template.startMin && s.endMin === template.endMin),
    );

    pushUndo(scheduleId, { key: "addShift", params: { shift: template.name } });
    db.transaction((tx) => {
      // Each row is exactly one weekday, so reclaiming it is a plain delete —
      // whatever segment it belonged to shrinks by one day (or disappears, if
      // this was its last one).
      for (const stolen of claimedElsewhere) {
        tx.delete(shifts).where(eq(shifts.id, stolen.id)).run();
      }
      tx.insert(shifts)
        .values({
          scheduleId,
          name: template.name,
          weekday,
          startMin: template.startMin,
          endMin: template.endMin,
          requiredMin: template.requiredMin,
          requiredIdeal: template.requiredIdeal,
          active: template.active,
        })
        .run();
    });
  } else {
    if (!existingHere) return;
    // Never leave a segment with no days at all — delete it instead.
    if (ids.length <= 1) return;
    pushUndo(scheduleId, { key: "deleteShift", params: { shift: template.name } });
    db.delete(shifts).where(eq(shifts.id, existingHere.id)).run();
  }
  refresh();
}

/**
 * Add a new segment under an existing shift name, so the user can give some
 * days a different time than the rest of the week.
 */
export async function addShiftSegment(scheduleId: number, name: string) {
  await requireAdmin(scheduleId);
  const sameName = db
    .select()
    .from(shifts)
    .where(and(eq(shifts.scheduleId, scheduleId), eq(shifts.name, name)))
    .all();
  if (sameName.length === 0) return;
  const template = sameName[0];

  // Every shift row owns exactly one weekday, so the new segment needs a day.
  // Prefer an unclaimed one; if the name already covers all five, take one from
  // whichever segment holds the most, so none is ever left empty.
  const claimed = new Set(sameName.map((s) => s.weekday));
  const free = SCHOOL_WEEKDAYS.find((d) => !claimed.has(d));
  let weekday: Weekday = free as Weekday;

  pushUndo(scheduleId, { key: "addShift", params: { shift: name } });

  db.transaction((tx) => {
    if (free === undefined) {
      const bySegment = new Map<string, typeof sameName>();
      for (const s of sameName) {
        const key = `${s.startMin}|${s.endMin}`;
        const list = bySegment.get(key);
        if (list) list.push(s);
        else bySegment.set(key, [s]);
      }
      const largest = [...bySegment.values()].sort((a, b) => b.length - a.length)[0];
      const donor = largest.length > 1 ? largest[largest.length - 1] : sameName[0];
      weekday = donor.weekday as Weekday;
      tx.delete(shifts).where(eq(shifts.id, donor.id)).run();
    }

    tx.insert(shifts)
      .values({
        scheduleId,
        name,
        weekday,
        // Placeholder time, deliberately not colliding with any existing
        // segment of this name — the user retimes it via the segment's fields.
        startMin: template.endMin,
        endMin: Math.min(template.endMin + 60, 23 * 60 + 59),
        requiredMin: template.requiredMin,
        requiredIdeal: template.requiredIdeal,
        active: template.active,
      })
      .run();
  });

  refresh();
}

export async function deleteShiftGroup(scheduleId: number, ids: number[]) {
  await requireAdmin(scheduleId);
  if (ids.length === 0) return;
  pushUndo(scheduleId, { key: "deleteShift", params: { shift: shiftName(scheduleId, ids[0]) } });
  db.transaction((tx) => {
    for (const id of ids) tx.delete(shifts).where(ownedShift(scheduleId, id)).run();
  });
  refresh();
}

// --- Settings -------------------------------------------------------------

export async function updateSettings(scheduleId: number, next: SolverSettings) {
  await requireAdmin(scheduleId);
  pushUndo(scheduleId, { key: "editSettings" });
  saveSolverSettings(scheduleId, next);
  refresh();
}

export type { UndoLabel };
