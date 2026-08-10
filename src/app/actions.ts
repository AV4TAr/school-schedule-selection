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
import { solve } from "@/lib/solver";
import type { SolverSettings, Weekday } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

// --- Schedule -------------------------------------------------------------

/**
 * Re-solve the week and replace the stored assignments. Pinned assignments are
 * fed back in as constraints so the user's manual locks survive.
 */
export async function generateSchedule() {
  ensureCurrentSchedule();
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

  db.update(assignments)
    .set({ pinned: !row.pinned })
    .where(eq(assignments.id, row.id))
    .run();
  refresh();
}

export async function clearPins() {
  ensureCurrentSchedule();
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

  db.update(people).set(set).where(eq(people.id, id)).run();
  refresh();
}

export async function deletePerson(id: number) {
  db.delete(people).where(eq(people.id, id)).run();
  refresh();
}

export async function createAvailability(
  personId: number,
  weekday: Weekday,
  startMin: number,
  endMin: number,
) {
  if (endMin <= startMin) return;
  db.insert(availability).values({ personId, weekday, startMin, endMin }).run();
  refresh();
}

export async function updateAvailability(
  id: number,
  patch: { weekday?: Weekday; startMin?: number; endMin?: number },
) {
  const row = db.select().from(availability).where(eq(availability.id, id)).get();
  if (!row) return;
  const next = { ...row, ...patch };
  if (next.endMin <= next.startMin) return;

  db.update(availability)
    .set({ weekday: next.weekday, startMin: next.startMin, endMin: next.endMin })
    .where(eq(availability.id, id))
    .run();
  refresh();
}

export async function deleteAvailability(id: number) {
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
  db.insert(shifts).values({ ...clean, active: clean.active ?? true }).run();
  refresh();
}

export async function updateShift(id: number, input: ShiftInput) {
  const clean = normaliseShift(input);
  if (!clean) return;
  db.update(shifts)
    .set({ ...clean, active: clean.active ?? true })
    .where(eq(shifts.id, id))
    .run();
  refresh();
}

export async function deleteShift(id: number) {
  db.delete(shifts).where(eq(shifts.id, id)).run();
  refresh();
}

// --- Settings -------------------------------------------------------------

export async function updateSettings(next: SolverSettings) {
  saveSolverSettings(next);
  refresh();
}
