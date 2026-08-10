import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const availability = sqliteTable(
  "availability",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
  (t) => [index("availability_person_idx").on(t.personId, t.weekday)],
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    weekday: integer("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    requiredMin: integer("required_min").notNull().default(1),
    requiredIdeal: integer("required_ideal").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (t) => [index("shifts_weekday_idx").on(t.weekday, t.startMin)],
);

/**
 * A saved version of the weekly schedule. Keeping versions means a generated
 * plan can be compared against the previous one before it is adopted.
 */
export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

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

/** Simple key/value store for solver settings and UI preferences. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Undo history. Each row is a complete snapshot of the mutable state taken
 * *before* an action ran, so undoing is a restore rather than a hand-written
 * inverse for every operation. Capped at a handful of entries by `pushUndo`.
 */
export const undoStack = sqliteTable("undo_stack", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** JSON `{ key, params }`, translated in the UI rather than stored in one language. */
  label: text("label").notNull(),
  snapshot: text("snapshot").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
