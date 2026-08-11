"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateSettings } from "@/app/actions";
import { changePassword, updateScheduleCode, updateScheduleName } from "@/app/auth-actions";
import { MAX_CODE_LENGTH } from "@/lib/auth-shared";
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
  const weightFields: { key: keyof SolverWeights; label: string; hint: string }[] = [
    {
      key: "understaffCritical",
      label: t.settings.understaffCritical,
      hint: t.settings.understaffCriticalHint,
    },
    {
      key: "understaffIdeal",
      label: t.settings.understaffIdeal,
      hint: t.settings.understaffIdealHint,
    },
    { key: "fairness", label: t.settings.fairness, hint: t.settings.fairnessHint },
    { key: "idleTime", label: t.settings.idleTime, hint: t.settings.idleTimeHint },
    { key: "dayOff", label: t.settings.dayOff, hint: t.settings.dayOffHint },
    { key: "preferred", label: t.settings.preferred, hint: t.settings.preferredHint },
    { key: "avoid", label: t.settings.avoid, hint: t.settings.avoidHint },
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
          {weightFields.map(({ key, label, hint }, index) => (
            <NumberRow
              key={key}
              rank={index + 1}
              label={label}
              hint={hint}
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
    // Stacked on a phone: a long label beside a 7rem input leaves the text a
    // ~9rem column and shreds it. Two columns again from `md`, unchanged.
    <div className="grid items-start gap-2 px-4 py-3 md:grid-cols-[1fr_auto] md:gap-4">
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
          inputMode="numeric"
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
        {/* The unit column is held open on desktop even when empty, so inputs
            in a section line up; on a phone it would only be dead space. */}
        {unit ? (
          <span className="w-12 text-xs text-faint">{unit}</span>
        ) : (
          <span aria-hidden className="hidden w-12 md:block" />
        )}
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(scheduleName);
  const [codeDraft, setCodeDraft] = useState(code);
  const [codeMessage, setCodeMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submitCode = () => {
    setCodeMessage(null);
    startTransition(async () => {
      const result = await updateScheduleCode(scheduleId, codeDraft);
      if (result.ok) {
        router.push(`/s/${result.code}/settings`);
      } else {
        setCodeDraft(code);
        setCodeMessage({
          ok: false,
          text: result.error === "taken" ? t.settings.codeTaken : t.settings.codeInvalid,
        });
      }
    });
  };

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
          <label className="label" htmlFor="schedule-code-field">
            {t.settings.scheduleCode}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="schedule-code-field"
              // Codes are letters and digits, so the plain text keyboard is the
              // right one — just without autocorrect fighting the typist.
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="field num min-w-0 flex-1 font-semibold tracking-widest sm:w-52 sm:flex-none"
              maxLength={MAX_CODE_LENGTH}
              value={codeDraft}
              disabled={pending}
              onChange={(e) => setCodeDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
            />
            <button
              type="button"
              className="btn"
              disabled={pending || !codeDraft.trim() || codeDraft === code}
              onClick={submitCode}
            >
              {t.common.save}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted">{t.settings.scheduleCodeHint}</p>
          {codeMessage && (
            <p className="pill pill-danger mt-1.5">{codeMessage.text}</p>
          )}
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
          {/* Two 13rem fields never fit side by side on a phone, and wrapping
              them leaves a ragged half-empty row — so stack them instead. */}
          <div className="grid gap-2.5 sm:flex sm:flex-wrap sm:gap-2">
            <div>
              <label className="label" htmlFor="current-password">
                {t.settings.currentPassword}
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="field sm:w-52"
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
                className="field sm:w-52"
                value={next}
                disabled={pending}
                onChange={(e) => setNext(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPassword()}
              />
            </div>
            <button
              type="button"
              className="btn w-full sm:mt-auto sm:mb-0.5 sm:w-auto"
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
