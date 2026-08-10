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

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  const save = (next: SolverSettings) => {
    setDraft(next);
    setSaved(false);
    startTransition(async () => {
      await updateSettings(next);
      setSaved(true);
    });
  };

  const weightFields: { key: keyof SolverWeights; label: string }[] = [
    { key: "understaffCritical", label: t.settings.understaffCritical },
    { key: "understaffIdeal", label: t.settings.understaffIdeal },
    { key: "fairness", label: t.settings.fairness },
    { key: "idleTime", label: t.settings.idleTime },
    { key: "dayOff", label: t.settings.dayOff },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.settings.subtitle}</p>
      </header>

      <section className="card space-y-3 p-4">
        <h2 className="font-medium">{t.settings.language}</h2>
        <div className="flex gap-2">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              className={`btn ${locale === code ? "btn-primary" : ""}`}
            >
              {LOCALE_NAMES[code]}
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="font-medium">{t.settings.rules}</h2>

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
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="font-medium">{t.settings.weights}</h2>
          <p className="mt-1 text-xs text-muted">{t.settings.weightsHint}</p>
        </div>

        {weightFields.map(({ key, label }) => (
          <NumberRow
            key={key}
            label={label}
            value={draft.weights[key]}
            disabled={pending}
            onChange={(value) =>
              save({ ...draft, weights: { ...draft.weights, [key]: value } })
            }
          />
        ))}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => save(DEFAULT_SETTINGS)}
        >
          {t.settings.reset}
        </button>
        {pending && <span className="text-sm text-muted">{t.common.saving}</span>}
        {!pending && saved && !dirty && (
          <span className="text-sm text-ok">{t.settings.saved}</span>
        )}
      </div>
    </div>
  );
}

function NumberRow({
  label,
  hint,
  unit,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  unit?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Keep the input in step with the value when it is changed elsewhere (reset).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4">
      <div>
        <label className="text-sm font-medium">{label}</label>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          className="field w-28 text-right tabular-nums"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = Number(draft);
            if (!Number.isFinite(parsed) || parsed < 0) return setDraft(String(value));
            if (parsed !== value) onChange(parsed);
          }}
        />
        {unit && <span className="w-14 text-xs text-muted">{unit}</span>}
      </div>
    </div>
  );
}
