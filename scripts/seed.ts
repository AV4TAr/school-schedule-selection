/**
 * Create a demo schedule populated from `src/lib/db/seed-data.ts`.
 *
 *   npm run db:seed                       migrate only (safe on every deploy)
 *   npm run db:seed -- --demo             create a demo schedule, print its code
 *   npm run db:seed -- --demo --generate  ...and solve its first schedule
 *
 * Since schedules became multi-tenant this never touches existing data: it only
 * ever *adds* a schedule. There is deliberately no `--reset`.
 *
 * `DATABASE_PATH` picks the file, exactly as it does for the app.
 */

import { eq } from "drizzle-orm";

import { db } from "../src/lib/db/client";
import { ensureDatabase, seedSchedule } from "../src/lib/db/bootstrap";
import { assignments } from "../src/lib/db/schema";
import {
  createSchedule,
  getAvailability,
  getPeople,
  getShifts,
  getSolverSettings,
} from "../src/lib/db/queries";
import { generateCode, hashPassword } from "../src/lib/auth";
import { solve } from "../src/lib/solver";
import { toHours } from "../src/lib/time";

const args = new Set(process.argv.slice(2));
const demo = args.has("--demo");
const generate = args.has("--generate");

const unknown = [...args].filter((a) => !["--demo", "--generate"].includes(a));
if (unknown.length > 0) {
  console.error(`Unknown option(s): ${unknown.join(", ")}`);
  console.error("Usage: npm run db:seed -- [--demo] [--generate]");
  process.exit(1);
}

ensureDatabase();
console.log("Migrations are up to date.");

if (!demo) {
  console.log("Pass --demo to create a demo schedule.");
  process.exit(0);
}

const password = "demo1234";
const code = generateCode();
const scheduleId = createSchedule(code, "Demo schedule", hashPassword(password));
seedSchedule(scheduleId);

const staff = getPeople(scheduleId);
const slots = getShifts(scheduleId);
console.log(`\nCreated demo schedule "${code}"`);
console.log(`  password: ${password}`);
console.log(
  `  ${staff.length} people, ${slots.length} shifts, ${getAvailability(scheduleId).length} availability windows`,
);

if (generate) {
  const result = solve({
    people: staff,
    availability: getAvailability(scheduleId),
    shifts: slots,
    settings: getSolverSettings(scheduleId),
  });

  db.transaction((tx) => {
    tx.delete(assignments).where(eq(assignments.scheduleId, scheduleId)).run();
    for (const a of result.assignments) {
      tx.insert(assignments)
        .values({ scheduleId, shiftId: a.shiftId, personId: a.personId, pinned: false })
        .run();
    }
  });

  const critical = result.gaps.filter((g) => g.critical).length;
  console.log(
    `\nGenerated a schedule in ${result.elapsedMs} ms` +
      `${result.optimal ? " (proven optimal)" : " (search cut short)"}`,
  );
  console.log(`  ${result.assignments.length} assignments, ${critical} understaffed`);
  for (const w of [...result.workloads].sort((a, b) => b.totalMinutes - a.totalMinutes)) {
    const name = staff.find((p) => p.id === w.personId)?.name ?? "?";
    console.log(`  ${name.padEnd(10)} ${String(toHours(w.totalMinutes)).padStart(6)} h`);
  }
}
