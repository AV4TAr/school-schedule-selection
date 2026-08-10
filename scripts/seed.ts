/**
 * Seed the database from `src/lib/db/seed-data.ts`.
 *
 *   npm run db:seed                  seed only if the database is empty
 *   npm run db:seed -- --generate    ...and solve the first schedule
 *   npm run db:seed -- --reset       WIPE all data, then reseed
 *
 * Migrations always run first, so this is also the way to bring an existing
 * database up to date without starting the app.
 *
 * `DATABASE_PATH` picks the file, exactly as it does for the app.
 */

import { eq } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import {
  ensureDatabase,
  isEmpty,
  seedDatabase,
} from "../src/lib/db/bootstrap";
import {
  assignments,
  availability,
  people,
  schedules,
  settings,
  shifts,
  undoStack,
} from "../src/lib/db/schema";
import {
  CURRENT_SCHEDULE_ID,
  ensureCurrentSchedule,
  getAvailability,
  getPeople,
  getShifts,
  getSolverSettings,
} from "../src/lib/db/queries";
import { solve } from "../src/lib/solver";
import { toHours } from "../src/lib/time";

const args = new Set(process.argv.slice(2));
const reset = args.has("--reset");
const generate = args.has("--generate");

const unknown = [...args].filter((a) => !["--reset", "--generate"].includes(a));
if (unknown.length > 0) {
  console.error(`Unknown option(s): ${unknown.join(", ")}`);
  console.error("Usage: npm run db:seed -- [--reset] [--generate]");
  process.exit(1);
}

// Runs migrations. On a genuinely fresh file this also seeds, which makes the
// plain `npm run db:seed` a no-op afterwards — that is the intended safe path.
ensureDatabase();

if (reset) {
  console.warn("--reset: deleting all existing data");
  db.transaction((tx) => {
    // Children before parents; foreign keys are enforced.
    tx.delete(undoStack).run();
    tx.delete(assignments).run();
    tx.delete(availability).run();
    tx.delete(shifts).run();
    tx.delete(people).run();
    tx.delete(settings).run();
    tx.delete(schedules).run();
  });
  seedDatabase();
  console.log("Reseeded from seed-data.ts");
} else if (isEmpty()) {
  seedDatabase();
  console.log("Seeded an empty database from seed-data.ts");
} else {
  console.log("Database already has data — nothing to do.");
  console.log("Pass --reset to wipe it and start over.");
}

ensureCurrentSchedule();

const staff = getPeople();
const slots = getShifts();
console.log(`  ${staff.length} people, ${slots.length} shifts, ${getAvailability().length} availability windows`);

if (generate) {
  const result = solve({
    people: staff,
    availability: getAvailability(),
    shifts: slots,
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
          pinned: false,
        })
        .run();
    }
  });

  const critical = result.gaps.filter((g) => g.critical).length;
  const soft = result.gaps.length - critical;
  console.log(
    `\nGenerated a schedule in ${result.elapsedMs} ms` +
      `${result.optimal ? " (proven optimal)" : " (search cut short)"}`,
  );
  console.log(`  ${result.assignments.length} assignments`);
  console.log(`  ${critical} understaffed shift(s), ${soft} below preferred`);
  for (const w of [...result.workloads].sort((a, b) => b.totalMinutes - a.totalMinutes)) {
    const name = staff.find((p) => p.id === w.personId)?.name ?? "?";
    console.log(`  ${name.padEnd(10)} ${String(toHours(w.totalMinutes)).padStart(6)} h`);
  }
}
