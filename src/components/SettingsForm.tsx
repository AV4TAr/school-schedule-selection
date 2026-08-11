"use client";

import { useState, useTransition } from "react";

import { updateSettings } from "@/app/actions";
import { changePassword, updateScheduleName } from "@/app/auth-actions";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/dictionaries";
import { DEFAULT_SETTINGS, type SolverSettings, type SolverWeights } from "@/lib/types";

export function SettingsForm({
  scheduleId,
  code,
  scheduleName,
  initial,
}: {
  scheduleId: number;
  code: string;
  scheduleName: string;
  initial: SolverSettings;
}) {
  const { t, locale, setLocale } = useI18n();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<SolverSettings>(initial);
  const [saved, setSaved] = useState(false);

  const save = (next: SolverSettings) => {
    setDraft(next);
    setSaved(false);
    startTransition(async () => {
      await updateSettings(scheduleId, next);
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

      <ScheduleSection
        scheduleId={scheduleId}
        code={code}
        scheduleName={scheduleName}
      />

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

/** Identity and access for this schedule: its share code, name and password. */
function ScheduleSection({
  scheduleId,
  code,
  scheduleName,
}: {
  scheduleId: number;
  code: string;
  scheduleName: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(scheduleName);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submitPassword = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await changePassword(scheduleId, current, next);
      if (result.ok) {
        setCurrent("");
        setNext("");
        setMessage({ ok: true, text: t.settings.passwordChanged });
      } else {
        setMessage({
          ok: false,
          text:
            result.error === "passwordShort"
              ? t.auth.passwordTooShort
              : t.auth.wrongPassword,
        });
      }
    });
  };

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line bg-raised/50 px-4 py-2.5 text-sm font-semibold">
        {t.settings.scheduleSection}
      </h2>

      <div className="divide-y divide-line">
        <div className="px-4 py-3">
          <label className="label">{t.settings.scheduleCode}</label>
          <p className="num rounded-[var(--r-sm)] border border-line bg-raised px-3 py-2 text-base font-semibold tracking-widest select-all">
            {code}
          </p>
          <p className="mt-1.5 text-xs text-muted">{t.settings.scheduleCodeHint}</p>
        </div>

        <div className="px-4 py-3">
          <label className="label" htmlFor="schedule-name-field">
            {t.settings.scheduleNameLabel}
          </label>
          <input
            id="schedule-name-field"
            className="field max-w-sm"
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (!trimmed || trimmed === scheduleName) return setName(scheduleName);
              startTransition(() => void updateScheduleName(scheduleId, trimmed));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </div>

        <div className="space-y-2.5 px-4 py-3">
          <h3 className="text-sm font-medium">{t.settings.changePassword}</h3>
          <div className="flex flex-wrap gap-2">
            <div>
              <label className="label" htmlFor="current-password">
                {t.settings.currentPassword}
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="field w-52"
                value={current}
                disabled={pending}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="next-password">
                {t.settings.newPassword}
              </label>
              <input
                id="next-password"
                type="password"
                autoComplete="new-password"
                className="field w-52"
                value={next}
                disabled={pending}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn mt-auto mb-0.5"
              disabled={pending || !next}
              onClick={submitPassword}
            >
              {t.common.save}
            </button>
          </div>
          {message && (
            <p className={`pill ${message.ok ? "pill-ok" : "pill-danger"}`}>
              {message.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
