import "server-only";

import fs from "node:fs";
import path from "node:path";
import {
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import { CODE_ALPHABET, CODE_LENGTH } from "./auth-shared";

/**
 * Access model
 * ------------
 * A schedule's `code` is the read capability: anyone holding it can view, and
 * it appears in the URL. The password is the *write* capability, verified once
 * and then carried in a signed cookie scoped to that one schedule.
 *
 * Passwords are never stored — only a scrypt hash with a per-schedule random
 * salt. Cookies carry no secret material, just a schedule id and an expiry,
 * signed with a server-side key so they cannot be forged client-side.
 */


/** e.g. `K7M2-QX4P`. ~31^8 ≈ 8.5e11 possibilities. */
export function generateCode(): string {
  let out = "";
  // randomInt is rejection-sampled, so no modulo bias across the alphabet.
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export { isValidCustomCode, normaliseCode } from "./auth-shared";

// --- Passwords -------------------------------------------------------------

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  // Constant-time: a length mismatch alone must not short-circuit.
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

// --- Session signing -------------------------------------------------------

/**
 * The key that signs session cookies. Generated once and kept out of git —
 * regenerating it simply invalidates every existing admin session, which is a
 * safe failure mode.
 */
function sessionSecret(): Buffer {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return Buffer.from(fromEnv, "utf8");

  const dir = path.dirname(
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "schedule.db"),
  );
  const file = path.join(dir, ".session-secret");
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, "utf8"), "hex");

  const secret = randomBytes(32);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret.toString("hex"), { mode: 0o600 });
  return secret;
}

export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Cookie name is per-schedule, so admin on one is never admin on another. */
export function sessionCookieName(scheduleId: number): string {
  return `sched_admin_${scheduleId}`;
}

export function signSession(scheduleId: number): string {
  const expires = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${scheduleId}.${expires}`;
  const mac = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}.${mac}`;
}

/** True only for a well-formed, unexpired, correctly-signed token. */
export function verifySession(token: string | undefined, scheduleId: number): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [idPart, expiresPart, mac] = parts;
  const payload = `${idPart}.${expiresPart}`;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("hex");

  const macBuf = Buffer.from(mac, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (macBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(macBuf, expectedBuf)) return false;

  if (Number(idPart) !== scheduleId) return false;
  return Number(expiresPart) > Date.now();
}
