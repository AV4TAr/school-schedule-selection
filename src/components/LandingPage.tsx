"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createNewSchedule, goToSchedule } from "@/app/auth-actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";

const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES" };

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-3">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-[var(--r-sm)] bg-accent text-2xs font-bold text-accent-fg"
          >
            SS
          </span>
          <span className="text-base font-semibold tracking-[-0.02em]">{t.appName}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
              {LOCALES.map((c) => (
                <LocaleButton key={c} code={c} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-6 py-12">
        <section>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{t.landing.tagline}</h1>
          <p className="mt-3 text-base leading-relaxed text-muted">{t.landing.intro}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { n: 1, title: t.landing.step1Title, body: t.landing.step1 },
            { n: 2, title: t.landing.step2Title, body: t.landing.step2 },
            { n: 3, title: t.landing.step3Title, body: t.landing.step3 },
          ].map((step) => (
            <div key={step.n} className="card p-4">
              <span className="num grid h-6 w-6 place-items-center rounded-[var(--r-full)] bg-accent-soft text-2xs font-bold text-accent">
                {step.n}
              </span>
              <h3 className="mt-2.5 text-sm font-semibold">{step.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <EnterCodeCard />
          <CreateScheduleCard />
        </div>
      </main>
    </div>
  );
}

function EnterCodeCard() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setNotFound(false);
    // Checks the code against the database before navigating, so a bad code
    // shows an inline error here instead of landing the visitor on a 404.
    startTransition(async () => {
      const result = await goToSchedule(code);
      if (!result.ok) setNotFound(true);
    });
  };

  return (
    <section className="card space-y-3 p-5">
      <h2 className="section-title">{t.landing.haveCode}</h2>
      <div>
        <label className="label" htmlFor="code">
          {t.landing.codeLabel}
        </label>
        <input
          id="code"
          className="field num tracking-widest uppercase"
          placeholder={t.landing.codePlaceholder}
          value={code}
          disabled={pending}
          onChange={(e) => {
            setCode(e.target.value);
            setNotFound(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>
      {notFound && <p className="pill pill-danger">{t.landing.codeNotFound}</p>}
      <button
        type="button"
        className="btn"
        disabled={pending || !code.trim()}
        onClick={submit}
      >
        {t.landing.open}
      </button>
    </section>
  );
}

function CreateScheduleCard() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await createNewSchedule(name, password);
      if (result.ok && result.code) {
        setCreatedCode(result.code);
        setPassword("");
      } else if (result.error === "name") {
        setError(t.landing.nameRequired);
      } else {
        setError(t.auth.passwordTooShort);
      }
    });
  };

  // Once created, the code is the only thing that matters on this card — it is
  // shown on its own so it cannot be missed or half-copied.
  if (createdCode) {
    return (
      <section className="card space-y-3 p-5">
        <h2 className="section-title">{t.landing.createdTitle}</h2>
        <p className="text-xs text-muted">{t.landing.createdCode}</p>
        <p className="num rounded-[var(--r-md)] border border-accent-line bg-accent-soft px-4 py-3 text-center text-lg font-bold tracking-widest text-accent select-all">
          {createdCode}
        </p>
        <p className="text-xs text-muted">{t.landing.createdWarning}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => router.push(`/s/${createdCode}`)}
        >
          {t.landing.goToSchedule}
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="section-title">{t.landing.createTitle}</h2>
      <p className="text-xs text-muted">{t.landing.createIntro}</p>

      <div>
        <label className="label" htmlFor="schedule-name">
          {t.landing.scheduleName}
        </label>
        <input
          id="schedule-name"
          className="field"
          placeholder={t.landing.scheduleNamePlaceholder}
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="new-password">
          {t.landing.choosePassword}
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="field"
          value={password}
          disabled={pending}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </div>

      {error && <p className="pill pill-danger">{error}</p>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={pending || !name.trim() || !password}
        onClick={submit}
      >
        {t.landing.create}
      </button>
    </section>
  );
}

function LocaleButton({ code }: { code: Locale }) {
  const { locale, setLocale } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(code)}
      aria-pressed={locale === code}
      className={`rounded-[3px] px-1.5 py-0.5 text-2xs font-semibold transition ${
        locale === code
          ? "bg-surface text-foreground shadow-[var(--e-1)]"
          : "text-faint hover:text-foreground"
      }`}
    >
      {LOCALE_CODE[code]}
    </button>
  );
}
