"use client";

import { useI18n } from "@/lib/i18n/context";
import { PREFERENCES, type Preference } from "@/lib/types";

/** Tone applied to whichever option is currently chosen. */
const TONE: Record<Preference, string> = {
  preferred: "border-ok-line bg-ok-soft text-ok",
  neutral: "border-line bg-raised text-muted",
  avoid: "border-warn-line bg-warn-soft text-warn",
};

/**
 * The same tones inside a `.seg`, whose track is already `--c-raised`: giving
 * the chosen neutral option that same background would make it vanish. Leaving
 * it blank lets `.seg-item[aria-pressed]` supply the raised-on-track contrast
 * the control was designed with.
 */
const SEG_TONE: Record<Preference, string> = {
  preferred: "bg-ok-soft text-ok",
  neutral: "",
  avoid: "bg-warn-soft text-warn",
};

const ICON: Record<Preference, string> = { preferred: "♥", neutral: "•", avoid: "✕" };

/**
 * Three-way soft preference for one availability window. Deliberately separate
 * from *whether* the person can work: removing the window is how you say no.
 * Nothing here can express "cannot work" — that is the absence of a window.
 *
 * Two shapes, one behaviour: a full-width segmented control on a phone, and the
 * dense inline group from `md` up. They are separate elements rather than one
 * element with responsive classes because the two shapes disagree on `display`,
 * border and background, and a `display: none` copy is neither focusable nor
 * announced — so there is exactly one live picker at any width.
 */
export function PreferencePicker({
  value,
  disabled,
  onChange,
}: {
  value: Preference;
  disabled?: boolean;
  onChange: (value: Preference) => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div role="group" aria-label={t.people.preference} className="seg w-full md:hidden">
        {PREFERENCES.map((option) => {
          const on = value === option;
          return (
            <button
              key={option}
              type="button"
              className={`seg-item ${on ? SEG_TONE[option] : ""}`}
              disabled={disabled}
              aria-pressed={on}
              title={t.people[`${option}Full` as const]}
              onClick={() => onChange(option)}
            >
              <span aria-hidden>{ICON[option]}</span>
              {t.people[option]}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label={t.people.preference}
        className="hidden items-center gap-0.5 rounded-[var(--r-sm)] border border-line p-0.5 md:flex"
      >
        {PREFERENCES.map((option) => {
          const on = value === option;
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              title={t.people[`${option}Full` as const]}
              onClick={() => onChange(option)}
              className={`rounded-[3px] border px-1.5 py-0.5 text-2xs font-medium transition ${
                on ? TONE[option] : "border-transparent text-faint hover:text-foreground"
              }`}
            >
              <span aria-hidden className="mr-1">
                {ICON[option]}
              </span>
              {t.people[option]}
            </button>
          );
        })}
      </div>
    </>
  );
}
