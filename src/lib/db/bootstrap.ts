import "server-only";

import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./client";
import { availability, people, shifts } from "./schema";
import { SEED_PEOPLE, SEED_SHIFTS } from "./seed-data";

let ready = false;

/**
 * Brings the database up to date. Called from every server entry point; the
 * `ready` flag makes it a no-op after the first invocation in a process.
 *
 * Deliberately does *not* seed. A schedule is created explicitly through the
 * create flow and starts empty — the example roster in `seed-data.ts` belongs
 * to one specific school and must never land in someone else's new schedule.
 */
export function ensureDatabase() {
  if (ready) return;
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  ready = true;
}

/**
 * Fill a schedule with the example roster and shifts. Used by the seed script
 * for demos, never on schedule creation.
 */
export function seedSchedule(scheduleId: number) {
  db.transaction((tx) => {
    for (const person of SEED_PEOPLE) {
      const [row] = tx
        .insert(people)
        .values({ scheduleId, name: person.name })
        .returning()
        .all();
      for (const w of person.windows) {
        tx.insert(availability)
          .values({
            scheduleId,
            personId: row.id,
            ...w,
            preference: w.preference ?? "neutral",
          })
          .run();
      }
    }

    for (const shift of SEED_SHIFTS) {
      for (const weekday of shift.weekdays) {
        tx.insert(shifts)
          .values({
            scheduleId,
            name: shift.name,
            weekday,
            startMin: shift.startMin,
            endMin: shift.endMin,
            requiredMin: shift.requiredMin,
            requiredIdeal: shift.requiredIdeal,
          })
          .run();
      }
    }
  });
}
