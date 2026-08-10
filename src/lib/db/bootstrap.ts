import "server-only";

import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { db } from "./client";
import { availability, people, schedules, shifts } from "./schema";
import { SEED_PEOPLE, SEED_SHIFTS } from "./seed-data";

let ready = false;

/**
 * Brings the database up to date and seeds it the first time it is created.
 * Called from every server entry point; the `ready` flag makes it a no-op after
 * the first invocation in a given process.
 */
export function ensureDatabase() {
  if (ready) return;
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

  if (isEmpty()) seedDatabase();

  ready = true;
}

/** True when no staff exist yet — the signal for a fresh database. */
export function isEmpty(): boolean {
  return db.select({ id: people.id }).from(people).limit(1).all().length === 0;
}

/** Insert the starting roster and shifts. Assumes the tables are empty. */
export function seedDatabase() {
  db.transaction((tx) => {
    for (const person of SEED_PEOPLE) {
      const [row] = tx.insert(people).values({ name: person.name }).returning().all();
      for (const w of person.windows) {
        tx.insert(availability)
          .values({ personId: row.id, ...w, preference: w.preference ?? "neutral" })
          .run();
      }
    }

    for (const shift of SEED_SHIFTS) {
      for (const weekday of shift.weekdays) {
        tx.insert(shifts)
          .values({
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

    tx.insert(schedules).values({ id: 1, name: "Current week" }).run();
  });
}
