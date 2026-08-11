import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

/**
 * A schedule is the tenant boundary. Everything else in the database belongs to
 * exactly one, and every query and action is scoped by it.
 *
 * `code` is the shareable, unguessable handle that appears in the URL and grants
 * read access. `passwordHash` gates *editing* — anyone with the code can look,
 * only someone with the password can change anything.
 */
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Short, random, URL-safe. Unique across all schedules. */
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  notes: text("notes"),
  /** `scrypt` hash as `salt:derivedKey`. Null means no admin password set yet. */
  passwordHash: text("password_hash"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

/**
 * NOTE ON `scheduleId`
 *
 * `.default(1)` exists only so the migration that introduced multi-tenancy
 * could backfill pre-existing rows onto the original schedule. Application code
 * must always pass `scheduleId` explicitly; relying on the default would
 * silently write another tenant's data into schedule 1.
 *
 * There is deliberately **no** `.references(schedules.id)` on these columns.
 * Declaring one would make `drizzle-kit generate` emit a table rebuild, and a
 * rebuild that drops a parent table inside Drizzle's transaction cascades and
 * destroys child rows (`PRAGMA foreign_keys=OFF` is a no-op in a transaction).
 * The cost is that deleting a schedule will not cascade at the database level —
 * that cleanup has to be explicit in application code.
 */

export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id").notNull().default(1),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("people_schedule_idx").on(t.scheduleId)],
);

export const availability = sqliteTable(
  "availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id").notNull().default(1),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    weekday: integer("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    /**
     * How the person feels about these hours: "preferred", "neutral" or
     * "avoid". Being unable to work is the absence of a window, not a value
     * here — that distinction is what keeps hard and soft rules separate.
     */
    preference: text("preference").notNull().default("neutral"),
  },
  (t) => [
    index("availability_person_idx").on(t.personId, t.weekday),
    index("availability_schedule_idx").on(t.scheduleId),
  ],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id").notNull().default(1),
    name: text("name").notNull(),
    weekday: integer("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    requiredMin: integer("required_min").notNull().default(1),
    requiredIdeal: integer("required_ideal").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [
    index("shifts_weekday_idx").on(t.weekday, t.startMin),
    index("shifts_schedule_idx").on(t.scheduleId),
  ],
);

export const assignments = sqliteTable(
  "assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    shiftId: integer("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Locked by the user; the solver must keep it on the next run. */
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique("assignments_unique").on(t.scheduleId, t.shiftId, t.personId),
    index("assignments_schedule_idx").on(t.scheduleId),
  ],
);

/** Per-schedule key/value store for solver settings and UI preferences. */
export const settings = sqliteTable(
  "settings",
  {
    scheduleId: integer("schedule_id").notNull().default(1),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.scheduleId, t.key] })],
);

/**
 * Undo history. Each row is a complete snapshot of one schedule's mutable state
 * taken *before* an action ran, so undoing is a restore rather than a
 * hand-written inverse for every operation. Capped per schedule by `pushUndo`.
 */
export const undoStack = sqliteTable(
  "undo_stack",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id").notNull().default(1),
    /** JSON `{ key, params }`, translated in the UI rather than stored in one language. */
    label: text("label").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("undo_schedule_idx").on(t.scheduleId)],
);

/**
 * Redo history — the mirror image of `undo_stack`. Undoing a step pushes the
 * state it just discarded here, so redo can restore it; any new mutating
 * action clears this per schedule, since it invalidates that "future" branch.
 */
export const redoStack = sqliteTable(
  "redo_stack",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scheduleId: integer("schedule_id").notNull().default(1),
    label: text("label").notNull(),
    snapshot: text("snapshot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("redo_schedule_idx").on(t.scheduleId)],
);
