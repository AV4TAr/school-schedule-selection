"use server";

import { redirect } from "next/navigation";

import { generateCode, hashPassword, normaliseCode, verifyPassword } from "@/lib/auth";
import {
  createSchedule,
  getPasswordHash,
  getScheduleByCode,
  renameSchedule,
  setPasswordHash,
} from "@/lib/db/queries";
import { endAdminSession, isAdmin, requireAdmin, startAdminSession } from "@/lib/session";

/**
 * Anything that creates a schedule or grants admin on one. Kept apart from
 * `actions.ts` because these are the only actions that may run *without* an
 * existing admin session — everything there begins by requiring one.
 */

const MIN_PASSWORD_LENGTH = 6;

export interface CreateResult {
  ok: boolean;
  error?: "name" | "password" | "passwordShort";
  code?: string;
}

/**
 * Create a new, empty schedule and sign the creator in as its admin. The code
 * is returned so the UI can show it once, prominently — it is the only handle
 * back to this schedule.
 */
export async function createNewSchedule(
  name: string,
  password: string,
): Promise<CreateResult> {
  const trimmedName = name.trim();
  if (!trimmedName) return { ok: false, error: "name" };
  if (!password) return { ok: false, error: "password" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, error: "passwordShort" };

  // Collisions are vanishingly unlikely, but a retry costs nothing and a
  // unique-constraint crash in front of a user costs more.
  let code = generateCode();
  for (let attempt = 0; attempt < 5 && getScheduleByCode(code); attempt++) {
    code = generateCode();
  }

  const scheduleId = createSchedule(code, trimmedName, hashPassword(password));
  await startAdminSession(scheduleId);
  return { ok: true, code };
}

/** Look up a code typed on the landing page and send the visitor to it. */
export async function goToSchedule(rawCode: string) {
  const code = normaliseCode(rawCode);
  if (!code) return { ok: false as const };
  if (!getScheduleByCode(code)) return { ok: false as const };
  redirect(`/s/${code}`);
}

export async function signIn(code: string, password: string) {
  const schedule = getScheduleByCode(code);
  if (!schedule) return { ok: false as const };

  // A schedule with no password yet accepts the first one offered, which is
  // how the pre-multi-tenancy schedule could be claimed if it had none.
  const stored = getPasswordHash(schedule.id);
  if (!stored) {
    if (password.length < MIN_PASSWORD_LENGTH) return { ok: false as const };
    setPasswordHash(schedule.id, hashPassword(password));
    await startAdminSession(schedule.id);
    return { ok: true as const };
  }

  if (!verifyPassword(password, stored)) return { ok: false as const };
  await startAdminSession(schedule.id);
  return { ok: true as const };
}

export async function signOut(code: string) {
  const schedule = getScheduleByCode(code);
  if (!schedule) return;
  await endAdminSession(schedule.id);
}

export async function changePassword(
  scheduleId: number,
  currentPassword: string,
  newPassword: string,
) {
  await requireAdmin(scheduleId);
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false as const, error: "passwordShort" as const };
  }
  const stored = getPasswordHash(scheduleId);
  if (stored && !verifyPassword(currentPassword, stored)) {
    return { ok: false as const, error: "wrongPassword" as const };
  }
  setPasswordHash(scheduleId, hashPassword(newPassword));
  return { ok: true as const };
}

export async function updateScheduleName(scheduleId: number, name: string) {
  await requireAdmin(scheduleId);
  renameSchedule(scheduleId, name);
}

/** Exposed so server components can branch on view-only vs admin. */
export async function checkAdmin(scheduleId: number): Promise<boolean> {
  return isAdmin(scheduleId);
}
