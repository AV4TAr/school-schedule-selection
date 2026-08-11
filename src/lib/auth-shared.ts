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

/** A custom code is a read capability, not a secret — the floor just keeps
 * it from being trivially guessable. The ceiling keeps it a usable URL segment. */
export const MIN_CUSTOM_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 15;

function clean(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
}

/**
 * Accepts the code in any case or spacing, returning "" when it can't be one.
 * Auto-generated codes are always exactly `CODE_LENGTH` characters and shown
 * with a separating dash; an admin-chosen custom code of any other length is
 * used as-is, so this must format an input the same way whether it is being
 * looked up or being saved as someone's new code.
 */
export function normaliseCode(input: string): string {
  const cleaned = clean(input);
  if (!cleaned || cleaned.length > MAX_CODE_LENGTH) return "";
  if (cleaned.length === CODE_LENGTH) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  return cleaned;
}

/** Whether input has enough characters to be set as a schedule's own code. */
export function isValidCustomCode(input: string): boolean {
  const length = clean(input).length;
  return length >= MIN_CUSTOM_CODE_LENGTH && length <= MAX_CODE_LENGTH;
}
