"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db/client";
import { assignments, availability, people, shifts } from "@/lib/db/schema";
import {
  CURRENT_SCHEDULE_ID,
  ensureCurrentSchedule,
  getAssignments,
  getAvailability,
  getPeople,
  getShifts,
  getSolverSettings,
  saveSolverSettings,
} from "@/lib/db/queries";
import { isAvailable } from "@/lib/availability";
import { popUndo, pushUndo, type UndoLabel } from "@/lib/db/undo";
import { solve } from "@/lib/solver";
import type { Preference, SolverSettings, Weekday } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

/** Look up a name for the undo label before the row is changed or removed. */
function personName(id: number): string {
  return db.select().from(people).where(eq(people.id, id)).get()?.name ?? "?";
}

function shiftName(id: number): string {
  return db.select().from(shifts).where(eq(shifts.id, id)).get()?.name ?? "?";
}

// --- Undo -----------------------------------------------------------------

/** Reverse the most recent action. Deliberately not itself undoable. */
export async function undoLast() {
  const label = popUndo();
  refresh();
  return label;
}

// --- Schedule -------------------------------------------------------------

/**
 * Re-solve the week and replace the stored assignments. Pinned assignments are
 * fed back in as constraints so the user's manual locks survive.
 */
export async function generateSchedule() {
  ensureCurrentSchedule();
  pushUndo({ key: "generate" });

  const pins = getAssignments().filter((a) => a.pinned);
  const result = solve({
    people: getPeople(),
    availability: getAvailability(),
    shifts: getShifts(),
    pins,
    settings: getSolverSettings(),
  });

  db.transaction((tx) => {
    tx.delete(assignments).where(eq(assignments.scheduleId, CURRENT_SCHEDULE_ID)).run();
    for (const a of result.assignments) {
      tx.insert(assignments)
        .values({
          scheduleId: CURRENT_SCHEDULE_ID,
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

export async function togglePin(shiftId: number, personId: number) {
  ensureCurrentSchedule();
  const row = db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.scheduleId, CURRENT_SCHEDULE_ID),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .get();
  if (!row) return;

  pushUndo({
    key: row.pinned ? "unpin" : "pin",
    params: { person: personName(personId), shift: shiftName(shiftId) },
  });

  db.update(assignments)
    .set({ pinned: !row.pinned })
    .where(eq(assignments.id, row.id))
    .run();
  refresh();
}

/**
 * Manually place someone on a shift. Manual placements are pinned by default:
 * the user just made a decision, and the next Generate must not silently
 * discard it.
 *
 * Refuses people who are not available — that is a hard rule, and the UI only
 * offers eligible candidates. Overstaffing past the preferred headcount is
 * allowed: the solver won't do it, but the user is entitled to.
 */
export async function addAssignment(shiftId: number, personId: number) {
  ensureCurrentSchedule();

  const shift = db.select().from(shifts).where(eq(shifts.id, shiftId)).get();
  if (!shift) return;

  const windows = getAvailability().filter((w) => w.personId === personId);
  if (!isAvailable({ ...shift, weekday: shift.weekday as Weekday }, windows)) return;

  const existing = db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.scheduleId, CURRENT_SCHEDULE_ID),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .get();
  if (existing) return;

  pushUndo({
    key: "addAssignment",
    params: { person: personName(personId), shift: shiftName(shiftId) },
  });
  db.insert(assignments)
    .values({ scheduleId: CURRENT_SCHEDULE_ID, shiftId, personId, pinned: true })
    .run();
  refresh();
}

/** Take someone off a shift. */
export async function removeAssignment(shiftId: number, personId: number) {
  ensureCurrentSchedule();
  pushUndo({
    key: "removeAssignment",
    params: { person: personName(personId), shift: shiftName(shiftId) },
  });
  db.delete(assignments)
    .where(
      and(
        eq(assignments.scheduleId, CURRENT_SCHEDULE_ID),
        eq(assignments.shiftId, shiftId),
        eq(assignments.personId, personId),
      ),
    )
    .run();
  refresh();
}

export async function clearPins() {
  ensureCurrentSchedule();
  pushUndo({ key: "clearPins" });
  db.update(assignments)
    .set({ pinned: false })
    .where(eq(assignments.scheduleId, CURRENT_SCHEDULE_ID))
    .run();
  refresh();
}

// --- Staff ----------------------------------------------------------------

export async function createPerson(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  pushUndo({ key: "addPerson", params: { person: trimmed } });
  db.insert(people).values({ name: trimmed }).run();
  refresh();
}

export async function updatePerson(id: number, patch: { name?: string; active?: boolean }) {
  const set: { name?: string; active?: boolean } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) return;
    set.name = trimmed;
  }
  if (patch.active !== undefined) set.active = patch.active;
  if (Object.keys(set).length === 0) return;

  pushUndo({ key: "editPerson", params: { person: personName(id) } });
  db.update(people).set(set).where(eq(people.id, id)).run();
  refresh();
}

export async function deletePerson(id: number) {
  pushUndo({ key: "deletePerson", params: { person: personName(id) } });
  db.delete(people).where(eq(people.id, id)).run();
  refresh();
}

export async function createAvailability(
  personId: number,
  weekday: Weekday,
  startMin: number,
  endMin: number,
  preference: Preference = "neutral",
) {
  if (endMin <= startMin) return;
  pushUndo({ key: "addWindow", params: { person: personName(personId) } });
  db.insert(availability)
    .values({ personId, weekday, startMin, endMin, preference })
    .run();
  refresh();
}

export async function updateAvailability(
  id: number,
  patch: {
    weekday?: Weekday;
    startMin?: number;
    endMin?: number;
    preference?: Preference;
  },
) {
  const row = db.select().from(availability).where(eq(availability.id, id)).get();
  if (!row) return;
  const next = { ...row, ...patch };
  if (next.endMin <= next.startMin) return;

  pushUndo({ key: "editWindow", params: { person: personName(row.personId) } });
  db.update(availability)
    .set({
      weekday: next.weekday,
      startMin: next.startMin,
      endMin: next.endMin,
      preference: next.preference,
    })
    .where(eq(availability.id, id))
    .run();
  refresh();
}

export async function deleteAvailability(id: number) {
  const row = db.select().from(availability).where(eq(availability.id, id)).get();
  if (!row) return;
  pushUndo({ key: "deleteWindow", params: { person: personName(row.personId) } });
  db.delete(availability).where(eq(availability.id, id)).run();
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

export async function createShift(input: ShiftInput) {
  const clean = normaliseShift(input);
  if (!clean) return;
  pushUndo({ key: "addShift", params: { shift: clean.name } });
  db.insert(shifts).values({ ...clean, active: clean.active ?? true }).run();
  refresh();
}

export async function updateShift(id: number, input: ShiftInput) {
  const clean = normaliseShift(input);
  if (!clean) return;
  pushUndo({ key: "editShift", params: { shift: shiftName(id) } });
  db.update(shifts)
    .set({ ...clean, active: clean.active ?? true })
    .where(eq(shifts.id, id))
    .run();
  refresh();
}

export async function deleteShift(id: number) {
  pushUndo({ key: "deleteShift", params: { shift: shiftName(id) } });
  db.delete(shifts).where(eq(shifts.id, id)).run();
  refresh();
}

/**
 * The Shifts screen groups the same slot across weekdays into one row, so these
 * operate on a whole group at once. `ids` is every shift in the group.
 */
export async function updateShiftGroup(
  ids: number[],
  input: Omit<ShiftInput, "weekday">,
) {
  if (ids.length === 0) return;
  const clean = normaliseShift({ ...input, weekday: 1 });
  if (!clean) return;

  pushUndo({ key: "editShift", params: { shift: shiftName(ids[0]) } });
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
        .where(eq(shifts.id, id))
        .run();
    }
  });
  refresh();
}

/** Turn one weekday of a shift group on or off. */
export async function setShiftWeekday(
  ids: number[],
  weekday: Weekday,
  enabled: boolean,
) {
  if (ids.length === 0) return;
  const template = db.select().from(shifts).where(eq(shifts.id, ids[0])).get();
  if (!template) return;

  const existing = db
    .select()
    .from(shifts)
    .all()
    .find(
      (s) =>
        s.weekday === weekday &&
        s.name === template.name &&
        s.startMin === template.startMin &&
        s.endMin === template.endMin,
    );

  if (enabled) {
    if (existing) return;
    pushUndo({ key: "addShift", params: { shift: template.name } });
    db.insert(shifts)
      .values({
        name: template.name,
        weekday,
        startMin: template.startMin,
        endMin: template.endMin,
        requiredMin: template.requiredMin,
        requiredIdeal: template.requiredIdeal,
        active: template.active,
      })
      .run();
  } else {
    if (!existing) return;
    // Never leave a group with no days at all — delete the group instead.
    if (ids.length <= 1) return;
    pushUndo({ key: "deleteShift", params: { shift: template.name } });
    db.delete(shifts).where(eq(shifts.id, existing.id)).run();
  }
  refresh();
}

export async function deleteShiftGroup(ids: number[]) {
  if (ids.length === 0) return;
  pushUndo({ key: "deleteShift", params: { shift: shiftName(ids[0]) } });
  db.transaction((tx) => {
    for (const id of ids) tx.delete(shifts).where(eq(shifts.id, id)).run();
  });
  refresh();
}

// --- Settings -------------------------------------------------------------

export async function updateSettings(next: SolverSettings) {
  pushUndo({ key: "editSettings" });
  saveSolverSettings(next);
  refresh();
}

export type { UndoLabel };
