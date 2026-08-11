import "server-only";

import { and, desc, eq, notInArray } from "drizzle-orm";

import { db } from "./client";
import { ensureDatabase } from "./bootstrap";
import { assignments, availability, people, settings, shifts, undoStack } from "./schema";

/** How many steps back the user can go, per schedule. */
export const UNDO_DEPTH = 5;

/**
 * Identifies what an undo step would reverse. Stored as a key plus parameters
 * rather than a finished sentence, so the button reads in whichever language
 * the user has selected — including a language chosen after the action ran.
 */
export interface UndoLabel {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * A complete copy of one schedule's mutable state. Small enough (a few
 * kilobytes) that snapshotting everything beats maintaining an inverse for each
 * action type, and it stays correct when an action touches several tables.
 *
 * Everything here is scoped to a single schedule: an undo must never restore
 * one tenant's rows over another's.
 */
interface Snapshot {
  people: (typeof people.$inferSelect)[];
  availability: (typeof availability.$inferSelect)[];
  shifts: (typeof shifts.$inferSelect)[];
  assignments: (typeof assignments.$inferSelect)[];
  settings: (typeof settings.$inferSelect)[];
}

function capture(scheduleId: number): Snapshot {
  return {
    people: db.select().from(people).where(eq(people.scheduleId, scheduleId)).all(),
    availability: db
      .select()
      .from(availability)
      .where(eq(availability.scheduleId, scheduleId))
      .all(),
    shifts: db.select().from(shifts).where(eq(shifts.scheduleId, scheduleId)).all(),
    assignments: db
      .select()
      .from(assignments)
      .where(eq(assignments.scheduleId, scheduleId))
      .all(),
    settings: db.select().from(settings).where(eq(settings.scheduleId, scheduleId)).all(),
  };
}

/**
 * Record the current state before a mutation. Call at the top of every action
 * that changes data — never from `undoLast` itself, which would make undo
 * undo itself.
 */
export function pushUndo(scheduleId: number, label: UndoLabel) {
  ensureDatabase();
  db.insert(undoStack)
    .values({
      scheduleId,
      label: JSON.stringify(label),
      snapshot: JSON.stringify(capture(scheduleId)),
    })
    .run();

  // Trim to the newest UNDO_DEPTH entries for this schedule.
  const keep = db
    .select({ id: undoStack.id })
    .from(undoStack)
    .where(eq(undoStack.scheduleId, scheduleId))
    .orderBy(desc(undoStack.id))
    .limit(UNDO_DEPTH)
    .all()
    .map((row) => row.id);

  if (keep.length > 0) {
    db.delete(undoStack)
      .where(and(eq(undoStack.scheduleId, scheduleId), notInArray(undoStack.id, keep)))
      .run();
  }
}

/** Labels of the available steps, newest first — drives the undo button. */
export function getUndoLabels(scheduleId: number): UndoLabel[] {
  ensureDatabase();
  return db
    .select({ label: undoStack.label })
    .from(undoStack)
    .where(eq(undoStack.scheduleId, scheduleId))
    .orderBy(desc(undoStack.id))
    .limit(UNDO_DEPTH)
    .all()
    .map((row) => {
      try {
        return JSON.parse(row.label) as UndoLabel;
      } catch {
        return { key: "unknown" };
      }
    });
}

/**
 * Restore the most recent snapshot for this schedule and drop it from the
 * stack. Returns the label of what was undone, or null when there is nothing.
 */
export function popUndo(scheduleId: number): UndoLabel | null {
  ensureDatabase();
  const row = db
    .select()
    .from(undoStack)
    .where(eq(undoStack.scheduleId, scheduleId))
    .orderBy(desc(undoStack.id))
    .limit(1)
    .get();
  if (!row) return null;

  let snapshot: Snapshot;
  try {
    snapshot = JSON.parse(row.snapshot) as Snapshot;
  } catch {
    // A corrupt row would otherwise wedge the stack; discard and report nothing.
    db.delete(undoStack).where(eq(undoStack.id, row.id)).run();
    return null;
  }

  db.transaction((tx) => {
    // Delete children before parents, then insert parents before children:
    // foreign keys are enforced. Every delete is scoped, so a restore can
    // never reach outside this schedule.
    tx.delete(assignments).where(eq(assignments.scheduleId, scheduleId)).run();
    tx.delete(availability).where(eq(availability.scheduleId, scheduleId)).run();
    tx.delete(shifts).where(eq(shifts.scheduleId, scheduleId)).run();
    tx.delete(people).where(eq(people.scheduleId, scheduleId)).run();
    tx.delete(settings).where(eq(settings.scheduleId, scheduleId)).run();

    // Explicit ids are preserved so assignments and pins keep pointing at the
    // same rows they did before.
    for (const p of snapshot.people) tx.insert(people).values(p).run();
    for (const s of snapshot.shifts) tx.insert(shifts).values(s).run();
    for (const w of snapshot.availability) tx.insert(availability).values(w).run();
    for (const a of snapshot.assignments) tx.insert(assignments).values(a).run();
    for (const s of snapshot.settings) tx.insert(settings).values(s).run();

    tx.delete(undoStack).where(eq(undoStack.id, row.id)).run();
  });

  try {
    return JSON.parse(row.label) as UndoLabel;
  } catch {
    return { key: "unknown" };
  }
}
