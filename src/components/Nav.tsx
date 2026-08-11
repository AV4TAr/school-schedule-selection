"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/ThemeToggle";
import { UndoButton } from "@/components/UndoButton";
import type { UndoLabel } from "@/lib/db/undo";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";

/** Two-letter code reads better than the full language name at this size. */
const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES" };

export function Nav({ undoLabels }: { undoLabels: UndoLabel[] }) {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();

  // /my-schedule is the staff-facing read-only view — it gets its own minimal
  // header (see MyScheduleView) rather than the admin nav with links to
  // Staff/Shifts/Settings, which isn't this audience's business.
  if (pathname.startsWith("/my-schedule")) return null;

  const links = [
    { href: "/", label: t.nav.schedule },
    { href: "/people", label: t.nav.people },
    { href: "/shifts", label: t.nav.shifts },
    { href: "/settings", label: t.nav.settings },
  ];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-2.5">
        <Link href="/" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-[var(--r-sm)] bg-accent text-2xs font-bold text-accent-fg"
          >
            SS
          </span>
          <span className="hidden text-base font-semibold tracking-[-0.02em] lg:inline">
            {t.appName}
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
          <Link href="/my-schedule" className="btn btn-sm hidden sm:inline-flex">
            {t.nav.myScheduleLink}
          </Link>
          <UndoButton labels={undoLabels} />
          <ThemeToggle />

          <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
            {LOCALES.map((code) => (
              <button
                key={code}
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
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
