import "server-only";

import { desc, eq, notInArray } from "drizzle-orm";

import { db } from "./client";
import { ensureDatabase } from "./bootstrap";
import { assignments, availability, people, settings, shifts, undoStack } from "./schema";

/** How many steps back the user can go. */
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
 * A complete copy of the mutable state. Small enough (a few kilobytes) that
 * snapshotting everything beats maintaining an inverse for each action type,
 * and it stays correct when an action touches several tables at once.
 */
interface Snapshot {
  people: (typeof people.$inferSelect)[];
  availability: (typeof availability.$inferSelect)[];
  shifts: (typeof shifts.$inferSelect)[];
  assignments: (typeof assignments.$inferSelect)[];
  settings: (typeof settings.$inferSelect)[];
}

function capture(): Snapshot {
  return {
    people: db.select().from(people).all(),
    availability: db.select().from(availability).all(),
    shifts: db.select().from(shifts).all(),
    assignments: db.select().from(assignments).all(),
    settings: db.select().from(settings).all(),
  };
}

/**
 * Record the current state before a mutation. Call at the top of every action
 * that changes data — never from `undoLast` itself, which would make undo
 * undo itself.
 */
export function pushUndo(label: UndoLabel) {
  ensureDatabase();
  db.insert(undoStack)
    .values({ label: JSON.stringify(label), snapshot: JSON.stringify(capture()) })
    .run();

  // Trim to the newest UNDO_DEPTH entries.
  const keep = db
    .select({ id: undoStack.id })
    .from(undoStack)
    .orderBy(desc(undoStack.id))
    .limit(UNDO_DEPTH)
    .all()
    .map((row) => row.id);
  if (keep.length > 0) {
    db.delete(undoStack).where(notInArray(undoStack.id, keep)).run();
  }
}

/** Labels of the available steps, newest first — drives the undo button. */
export function getUndoLabels(): UndoLabel[] {
  ensureDatabase();
  return db
    .select({ label: undoStack.label })
    .from(undoStack)
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
 * Restore the most recent snapshot and drop it from the stack.
 * Returns the label of what was undone, or null when there is nothing to undo.
 */
export function popUndo(): UndoLabel | null {
  ensureDatabase();
  const row = db.select().from(undoStack).orderBy(desc(undoStack.id)).limit(1).get();
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
    // foreign keys are enforced.
    tx.delete(assignments).run();
    tx.delete(availability).run();
    tx.delete(shifts).run();
    tx.delete(people).run();
    tx.delete(settings).run();

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
