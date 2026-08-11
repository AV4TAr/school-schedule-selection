/**
 * Code helpers usable from both the server and the browser.
 *
 * Kept apart from `auth.ts` — which is `server-only` because it touches
 * password hashing and the session key — so the landing page can normalise a
 * typed-in code client-side without pulling any of that into the bundle.
 */

/**
 * Deliberately excludes 0/O and 1/I/L: codes get read aloud and copied by hand,
 * and those pairs are the ones people get wrong.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 8;

/** Accepts the code in any case or spacing, returning "" when it can't be one. */
export function normaliseCode(input: string): string {
  const cleaned = input.toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (cleaned.length !== CODE_LENGTH) return "";
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
}
