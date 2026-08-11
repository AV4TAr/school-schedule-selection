"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { signOut } from "@/app/auth-actions";
import { RedoButton } from "@/components/RedoButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UndoButton } from "@/components/UndoButton";
import type { UndoLabel } from "@/lib/db/undo";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";

const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES" };

/**
 * Header for everything under /s/[code]. Admin-only destinations are hidden
 * entirely from view-only visitors rather than shown-and-rejected, so a
 * read-only link never leads somewhere that just says "no".
 */
export function ScheduleNav({
  scheduleId,
  code,
  scheduleName,
  isAdmin,
  undoLabels,
  redoLabels,
}: {
  scheduleId: number;
  code: string;
  scheduleName: string;
  isAdmin: boolean;
  undoLabels: UndoLabel[];
  redoLabels: UndoLabel[];
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const base = `/s/${code}`;
  // The staff view brings its own chrome; this header would be redundant there.
  if (pathname.startsWith(`${base}/my-schedule`)) return null;

  const links = [
    { href: base, label: t.nav.schedule, adminOnly: false },
    { href: `${base}/people`, label: t.nav.people, adminOnly: true },
    { href: `${base}/shifts`, label: t.nav.shifts, adminOnly: true },
    { href: `${base}/settings`, label: t.nav.settings, adminOnly: true },
  ].filter((link) => isAdmin || !link.adminOnly);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
        <Link href={base} className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] bg-accent text-2xs font-bold text-accent-fg"
          >
            SS
          </span>
          <span className="hidden truncate text-base font-semibold tracking-[-0.02em] lg:inline">
            {scheduleName}
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map((link) => {
            const active =
              link.href === base ? pathname === base : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-[var(--r-sm)] px-2.5 py-1.5 text-base transition ${
                  active
                    ? "bg-raised font-medium text-foreground"
                    : "text-muted hover:bg-raised hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {!isAdmin && (
            <span className="pill" title={t.auth.viewOnlyHint}>
              {t.auth.viewOnly}
            </span>
          )}

          <Link href={`${base}/my-schedule`} className="btn btn-sm hidden sm:inline-flex">
            {t.nav.myScheduleLink}
          </Link>

          {isAdmin ? (
            <>
              <UndoButton scheduleId={scheduleId} labels={undoLabels} />
              <RedoButton scheduleId={scheduleId} labels={redoLabels} />
              <button
                type="button"
                className="btn btn-sm"
                disabled={pending}
                onClick={() => startTransition(() => void signOut(code))}
              >
                {t.auth.signOut}
              </button>
            </>
          ) : (
            <Link href={`${base}/login`} className="btn btn-sm btn-primary">
              {t.auth.signIn}
            </Link>
          )}

          <ThemeToggle />

          <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
            {LOCALES.map((c) => (
              <LocaleButton key={c} code={c} />
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function LocaleButton({ code }: { code: Locale }) {
  const { locale, setLocale } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLocale(code)}
      aria-pressed={locale === code}
      title={code === "en" ? "English" : "Español"}
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
