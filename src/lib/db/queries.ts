import "server-only";

import { and, asc, eq } from "drizzle-orm";

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

/**
 * Every read below is scoped by `scheduleId`. That parameter is the tenant
 * boundary: a missing filter here would leak one school's roster into
 * another's screen, so none of these functions have an unscoped variant.
 */

const SOLVER_SETTINGS_KEY = "solver";

export interface ScheduleRecord {
  id: number;
  code: string;
  name: string;
  notes: string | null;
  hasPassword: boolean;
  createdAt: string;
}

/** Resolves the URL's code to a schedule, or null when it doesn't exist. */
export function getScheduleByCode(code: string): ScheduleRecord | null {
  ensureDatabase();
  const row = db.select().from(schedules).where(eq(schedules.code, code)).get();
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    notes: row.notes,
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt,
  };
}

/** The stored hash, for password verification only. Never send this to a client. */
export function getPasswordHash(scheduleId: number): string | null {
  ensureDatabase();
  const row = db.select().from(schedules).where(eq(schedules.id, scheduleId)).get();
  return row?.passwordHash ?? null;
}

export function setPasswordHash(scheduleId: number, hash: string) {
  ensureDatabase();
  db.update(schedules).set({ passwordHash: hash }).where(eq(schedules.id, scheduleId)).run();
}

export function createSchedule(code: string, name: string, passwordHash: string): number {
  ensureDatabase();
  const [row] = db
    .insert(schedules)
    .values({ code, name, passwordHash })
    .returning()
    .all();
  return row.id;
}

export function setScheduleCode(scheduleId: number, code: string) {
  ensureDatabase();
  db.update(schedules).set({ code }).where(eq(schedules.id, scheduleId)).run();
}

export function renameSchedule(scheduleId: number, name: string) {
  ensureDatabase();
  const trimmed = name.trim();
  if (!trimmed) return;
  db.update(schedules).set({ name: trimmed }).where(eq(schedules.id, scheduleId)).run();
}

// --- Scoped reads ----------------------------------------------------------

export function getPeople(scheduleId: number): Person[] {
  ensureDatabase();
  return db
    .select()
    .from(people)
    .where(eq(people.scheduleId, scheduleId))
    .orderBy(asc(people.name))
    .all()
    .map((row) => ({ id: row.id, name: row.name, active: row.active }));
}

export function getAvailability(scheduleId: number): AvailabilityWindow[] {
  ensureDatabase();
  return db
    .select()
    .from(availability)
    .where(eq(availability.scheduleId, scheduleId))
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

export function getShifts(scheduleId: number): Shift[] {
  ensureDatabase();
  return db
    .select()
    .from(shifts)
    .where(eq(shifts.scheduleId, scheduleId))
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

export function getAssignments(scheduleId: number): Assignment[] {
  ensureDatabase();
  return db
    .select()
    .from(assignments)
    .where(eq(assignments.scheduleId, scheduleId))
    .all()
    .map((row) => ({
      shiftId: row.shiftId,
      personId: row.personId,
      pinned: row.pinned,
    }));
}

export function getSolverSettings(scheduleId: number): SolverSettings {
  ensureDatabase();
  const row = db
    .select()
    .from(settings)
    .where(and(eq(settings.scheduleId, scheduleId), eq(settings.key, SOLVER_SETTINGS_KEY)))
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

export function saveSolverSettings(scheduleId: number, next: SolverSettings) {
  ensureDatabase();
  db.insert(settings)
    .values({ scheduleId, key: SOLVER_SETTINGS_KEY, value: JSON.stringify(next) })
    .onConflictDoUpdate({
      target: [settings.scheduleId, settings.key],
      set: { value: JSON.stringify(next) },
    })
    .run();
}
