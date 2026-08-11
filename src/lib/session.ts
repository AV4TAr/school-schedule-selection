import "server-only";

import { cookies } from "next/headers";

import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookieName,
  signSession,
  verifySession,
} from "./auth";

/**
 * Admin sessions live in a signed, httpOnly cookie named per schedule, so
 * holding admin on one schedule grants nothing on another.
 *
 * `isAdmin` is the single question every mutating action must ask. It is
 * checked server-side on every call — never inferred from what the client
 * sends, which is why actions take a `scheduleId` argument freely: the cookie,
 * not the argument, decides whether the caller may write to it.
 */

export async function isAdmin(scheduleId: number): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(sessionCookieName(scheduleId))?.value, scheduleId);
}

export async function startAdminSession(scheduleId: number) {
  const store = await cookies();
  store.set(sessionCookieName(scheduleId), signSession(scheduleId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    // The app is commonly served over plain HTTP on a LAN, where a `secure`
    // cookie would simply never be sent. Behind a TLS-terminating proxy this
    // flips on automatically.
    secure: process.env.NODE_ENV === "production" && process.env.ASSUME_HTTPS === "1",
  });
}

export async function endAdminSession(scheduleId: number) {
  const store = await cookies();
  store.delete(sessionCookieName(scheduleId));
}

/**
 * Guard for mutating server actions. Throws rather than returning a flag so a
 * forgotten check can't silently fall through into a write.
 */
export async function requireAdmin(scheduleId: number): Promise<void> {
  if (!(await isAdmin(scheduleId))) {
    throw new Error("Not authorised to modify this schedule");
  }
}
