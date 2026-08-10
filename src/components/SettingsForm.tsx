"use client";

import { useState, useTransition } from "react";

import { updateSettings } from "@/app/actions";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/dictionaries";
import { DEFAULT_SETTINGS, type SolverSettings, type SolverWeights } from "@/lib/types";

export function SettingsForm({ initial }: { initial: SolverSettings }) {
  const { t, locale, setLocale } = useI18n();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<SolverSettings>(initial);
  const [saved, setSaved] = useState(false);

  const save = (next: SolverSettings) => {
    setDraft(next);
    setSaved(false);
    startTransition(async () => {
      await updateSettings(next);
      setSaved(true);
    });
  };

  /** Listed in priority order — the same order the solver applies them. */
  const weightFields: { key: keyof SolverWeights; label: string }[] = [
    { key: "understaffCritical", label: t.settings.understaffCritical },
    { key: "understaffIdeal", label: t.settings.understaffIdeal },
    { key: "fairness", label: t.settings.fairness },
    { key: "idleTime", label: t.settings.idleTime },
    { key: "dayOff", label: t.settings.dayOff },
    { key: "preferred", label: t.settings.preferred },
    { key: "avoid", label: t.settings.avoid },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="page-title">{t.settings.title}</h1>
        <p className="mt-1 text-base text-muted">{t.settings.subtitle}</p>
      </header>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line bg-raised/50 px-4 py-2.5 text-sm font-semibold">
          {t.settings.language}
        </h2>
        <div className="flex gap-2 p-4">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              title={t.hints.language}
              className={`btn ${locale === code ? "btn-primary" : ""}`}
            >
              {LOCALE_NAMES[code]}
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line bg-raised/50 px-4 py-2.5 text-sm font-semibold">
          {t.settings.rules}
        </h2>
        <div className="divide-y divide-line">
          <NumberRow
            label={t.settings.maxGap}
            hint={t.settings.maxGapHint}
            unit={t.settings.minutes}
            value={draft.maxGapMinutes}
            disabled={pending}
            onChange={(maxGapMinutes) => save({ ...draft, maxGapMinutes })}
          />
          <NumberRow
            label={t.settings.maxOverlap}
            hint={t.settings.maxOverlapHint}
            unit={t.settings.minutes}
            value={draft.maxOverlapMinutes}
            disabled={pending}
            onChange={(maxOverlapMinutes) => save({ ...draft, maxOverlapMinutes })}
          />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line bg-raised/50 px-4 py-2.5">
          <h2 className="text-sm font-semibold">{t.settings.weights}</h2>
          <p className="mt-0.5 text-xs text-muted">{t.settings.weightsHint}</p>
        </div>
        <div className="divide-y divide-line">
          {weightFields.map(({ key, label }, index) => (
            <NumberRow
              key={key}
              rank={index + 1}
              label={label}
              value={draft.weights[key]}
              disabled={pending}
              onChange={(value) =>
                save({ ...draft, weights: { ...draft.weights, [key]: value } })
              }
            />
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn"
          title={t.hints.resetSettings}
          disabled={pending}
          onClick={() => save(DEFAULT_SETTINGS)}
        >
          {t.settings.reset}
        </button>
        {pending && <span className="text-base text-muted">{t.common.saving}</span>}
        {!pending && saved && <span className="pill pill-ok">{t.settings.saved}</span>}
      </div>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  unit,
  rank,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  unit?: string;
  /** Optional priority number, shown for the weight rows. */
  rank?: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Keep the input in step when the value changes elsewhere (e.g. reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4 px-4 py-3">
      <div className="flex gap-2.5">
        {rank !== undefined && (
          <span className="num mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-[var(--r-full)] bg-raised text-2xs font-semibold text-muted">
            {rank}
          </span>
        )}
        <div>
          <label className="text-base font-medium">{label}</label>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          className="field num w-28 text-right"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            if (!Number.isFinite(parsed) || parsed < 0) return setDraft(String(value));
            if (parsed !== value) onChange(parsed);
          }}
        />
        <span className="w-12 text-xs text-faint">{unit ?? ""}</span>
      </div>
    </div>
  );
}
