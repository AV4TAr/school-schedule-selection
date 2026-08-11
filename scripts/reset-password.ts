/**
 * Reset a schedule's admin password from the command line — for when nobody
 * remembers it and there is no "forgot password" flow in the UI.
 *
 *   npm run reset-password -- <code> <new-password>
 *
 * `DATABASE_PATH` picks the file, exactly as it does for the app. Inside the
 * running production container this is already /app/data/schedule.db, so
 * resetting a live schedule's password needs no extra flags:
 *
 *   docker exec school-schedule-selection npm run reset-password -- CODE newpass
 */

import { hashPassword } from "../src/lib/auth";
import { normaliseCode } from "../src/lib/auth-shared";
import { ensureDatabase } from "../src/lib/db/bootstrap";
import { getScheduleByCode, setPasswordHash } from "../src/lib/db/queries";

// Must match MIN_PASSWORD_LENGTH in src/app/auth-actions.ts.
const MIN_PASSWORD_LENGTH = 6;

const [rawCode, password] = process.argv.slice(2);

if (!rawCode || !password) {
  console.error("Usage: npm run reset-password -- <code> <new-password>");
  process.exit(1);
}

if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const code = normaliseCode(rawCode);
if (!code) {
  console.error(`"${rawCode}" isn't a valid code.`);
  process.exit(1);
}

ensureDatabase();

const schedule = getScheduleByCode(code);
if (!schedule) {
  console.error(`No schedule with code "${code}".`);
  process.exit(1);
}

setPasswordHash(schedule.id, hashPassword(password));
console.log(`Password reset for "${schedule.name}" (${schedule.code}).`);
