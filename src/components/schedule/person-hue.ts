/**
 * CSS colour for a person's hue slot. Slot 0 wraps onto the sixth palette
 * colour, which is why this is a helper rather than a template literal: the
 * `?? 0` / `=== 0 ? 6` dance was repeated at every call site and is easy to
 * get subtly wrong, and a person must keep the same colour everywhere.
 *
 * Only needed where a dot sits *outside* a `.chip` — inside one, the
 * `data-person` attribute already sets `--chip`.
 */
export function personColor(hue: number | undefined): string {
  return `var(--c-p${hue === undefined || hue === 0 ? 6 : hue})`;
}
