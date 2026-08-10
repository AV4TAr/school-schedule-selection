import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "./client";
import { assignments, availability, people, schedules, settings, shifts } from "./schema";
import { ensureDatabase } from "./bootstrap";
import {
  DEFAULT_SETTINGS,
  type Assignment,
  type AvailabilityWindow,
  type Person,
  type Preference,
  type Shift,
  type SolverSettings,
  type Weekday,
} from "../types";

/** The single working schedule. Versioning is supported by the schema but the UI keeps one. */
export const CURRENT_SCHEDULE_ID = 1;

const SOLVER_SETTINGS_KEY = "solver";

export function getPeople(): Person[] {
  ensureDatabase();
  return db
    .select()
    .from(people)
    .orderBy(asc(people.name))
    .all()
    .map((row) => ({ id: row.id, name: row.name, active: row.active }));
}

export function getAvailability(): AvailabilityWindow[] {
  ensureDatabase();
  return db
    .select()
    .from(availability)
    .orderBy(asc(availability.weekday), asc(availability.startMin))
    .all()
    .map((row) => ({
      id: row.id,
      personId: row.personId,
      weekday: row.weekday as Weekday,
      startMin: row.startMin,
      endMin: row.endMin,
      preference: row.preference as Preference,
    }));
}

export function getShifts(): Shift[] {
  ensureDatabase();
  return db
    .select()
    .from(shifts)
    .orderBy(asc(shifts.weekday), asc(shifts.startMin))
    .all()
    .map((row) => ({
      id: row.id,
      name: row.name,
      weekday: row.weekday as Weekday,
      startMin: row.startMin,
      endMin: row.endMin,
      requiredMin: row.requiredMin,
      requiredIdeal: row.requiredIdeal,
      active: row.active,
    }));
}

export function getAssignments(): Assignment[] {
  ensureDatabase();
  return db
    .select()
    .from(assignments)
    .where(eq(assignments.scheduleId, CURRENT_SCHEDULE_ID))
    .all()
    .map((row) => ({
      shiftId: row.shiftId,
      personId: row.personId,
      pinned: row.pinned,
    }));
}

export function getSolverSettings(): SolverSettings {
  ensureDatabase();
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, SOLVER_SETTINGS_KEY))
    .get();
  if (!row) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(row.value) as Partial<SolverSettings>;
    // Merge over the defaults so a settings row written by an older version
    // still yields a complete, valid object.
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      weights: { ...DEFAULT_SETTINGS.weights, ...parsed.weights },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSolverSettings(next: SolverSettings) {
  ensureDatabase();
  db.insert(settings)
    .values({ key: SOLVER_SETTINGS_KEY, value: JSON.stringify(next) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: JSON.stringify(next) },
    })
    .run();
}

/** Makes sure the row the assignments point at exists (fresh or wiped databases). */
export function ensureCurrentSchedule() {
  ensureDatabase();
  const row = db.select().from(schedules).where(eq(schedules.id, CURRENT_SCHEDULE_ID)).get();
  if (!row) {
    db.insert(schedules)
      .values({ id: CURRENT_SCHEDULE_ID, name: "Current week" })
      .run();
  }
}
