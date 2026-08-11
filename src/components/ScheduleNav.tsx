"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { signOut } from "@/app/auth-actions";
import { RedoButton } from "@/components/RedoButton";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UndoButton } from "@/components/UndoButton";
import type { UndoLabel } from "@/lib/db/undo";
import { useI18n } from "@/lib/i18n/context";
import { LOCALES, type Locale } from "@/lib/i18n/dictionaries";

const LOCALE_CODE: Record<Locale, string> = { en: "EN", es: "ES" };

type Section = "schedule" | "people" | "shifts" | "settings";

/**
 * Header for everything under /s/[code]. Admin-only destinations are hidden
 * entirely from view-only visitors rather than shown-and-rejected, so a
 * read-only link never leads somewhere that just says "no".
 *
 * Two navigations, one source of truth: the same `links` array renders as
 * inline header links from `md` up and as a bottom tab bar below it. Section
 * switching is the most frequent thing an admin does on a phone, and a tab bar
 * puts it under the thumb instead of behind a hamburger. Everything used once
 * a session — theme, language, sign out — moves into the overflow sheet.
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
  const [menuOpen, setMenuOpen] = useState(false);

  const base = `/s/${code}`;
  // The staff view brings its own chrome; this header would be redundant there.
  const onStaffView = pathname.startsWith(`${base}/my-schedule`);

  const allLinks: { href: string; label: string; section: Section; adminOnly: boolean }[] = [
    { href: base, label: t.nav.schedule, section: "schedule", adminOnly: false },
    { href: `${base}/people`, label: t.nav.people, section: "people", adminOnly: true },
    { href: `${base}/shifts`, label: t.nav.shifts, section: "shifts", adminOnly: true },
    { href: `${base}/settings`, label: t.nav.settings, section: "settings", adminOnly: true },
  ];
  const links = allLinks.filter((link) => isAdmin || !link.adminOnly);

  // One destination is not a navigation — a viewer gets no tab bar.
  const showTabBar = !onStaffView && links.length > 1;

  // The footer lives outside <main>, so the clearance for the fixed tab bar
  // has to sit on <body>. Applied from an effect, after hydration, so the
  // server markup stays identical for everyone.
  useEffect(() => {
    if (!showTabBar) return;
    document.body.classList.add("has-tabbar");
    return () => document.body.classList.remove("has-tabbar");
  }, [showTabBar]);

  if (onStaffView) return null;

  const isActive = (href: string) =>
    href === base ? pathname === base : pathname.startsWith(href);

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-x-2 gap-y-2 px-3 py-2 md:flex-wrap md:gap-x-4 md:px-6 md:py-2.5">
          <Link href={base} className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-sm)] bg-accent text-2xs font-bold text-accent-fg"
            >
              SS
            </span>
            {/* Visible on a phone, where the tab bar carries the section
                labels and the header has room; hidden in the middle range,
                where the inline links compete for the same space. */}
            <span className="truncate text-base font-semibold tracking-[-0.02em] md:hidden lg:inline">
              {scheduleName}
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`rounded-[var(--r-sm)] px-2.5 py-1.5 text-base transition ${
                  isActive(link.href)
                    ? "bg-raised font-medium text-foreground"
                    : "text-muted hover:bg-raised hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            {!isAdmin && (
              <span className="pill" title={t.auth.viewOnlyHint}>
                {t.auth.viewOnly}
              </span>
            )}

            <Link href={`${base}/my-schedule`} className="btn btn-sm hidden md:inline-flex">
              {t.nav.myScheduleLink}
            </Link>

            {isAdmin ? (
              <>
                <UndoButton scheduleId={scheduleId} labels={undoLabels} />
                <RedoButton scheduleId={scheduleId} labels={redoLabels} />
                <button
                  type="button"
                  className="btn btn-sm hidden md:inline-flex"
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

            <div className="hidden md:flex md:items-center md:gap-2">
              <ThemeToggle />
              <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
                {LOCALES.map((c) => (
                  <LocaleButton key={c} code={c} />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm md:hidden"
              aria-label={t.nav.more}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span aria-hidden className="text-lg leading-none">
                ⋯
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <Sheet title={t.nav.menu} onClose={() => setMenuOpen(false)}>
          <div className="flex flex-col py-1">
            <Link
              href={`${base}/my-schedule`}
              className="sheet-item"
              onClick={() => setMenuOpen(false)}
            >
              {t.nav.myScheduleLink}
            </Link>
            <Link
              href={`${base}/print`}
              className="sheet-item"
              onClick={() => setMenuOpen(false)}
            >
              {t.nav.print}
            </Link>

            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-muted">{t.theme.label}</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm text-muted">{t.settings.language}</span>
              <div className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5">
                {LOCALES.map((c) => (
                  <LocaleButton key={c} code={c} />
                ))}
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="sheet-item"
                disabled={pending}
                onClick={() => {
                  setMenuOpen(false);
                  startTransition(() => void signOut(code));
                }}
              >
                {t.auth.signOut}
              </button>
            )}
          </div>
        </Sheet>
      )}

      {showTabBar && (
        <nav className="tabbar no-print md:hidden" aria-label={t.nav.menu}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className="tabbar-item"
            >
              <TabIcon section={link.section} />
              <span className="truncate">{link.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </>
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

/**
 * Inline rather than an icon dependency: four glyphs at one size do not justify
 * a package, and these inherit `currentColor` so the active tab tints for free.
 */
function TabIcon({ section }: { section: Section }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (section) {
    case "people":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 19.5a5.4 5.4 0 0 0-2-4.2" />
        </svg>
      );
    case "shifts":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2.2" />
          <circle cx="8" cy="17" r="2.2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
          <path d="M3.5 9.5h17M9 4.5v15M15 4.5v15" />
        </svg>
      );
  }
}
