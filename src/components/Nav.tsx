"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useI18n } from "@/lib/i18n/context";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n/dictionaries";

export function Nav() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t.nav.schedule },
    { href: "/people", label: t.nav.people },
    { href: "/shifts", label: t.nav.shifts },
    { href: "/settings", label: t.nav.settings },
  ];

  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
        <span className="text-sm font-semibold tracking-tight">{t.appName}</span>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-line p-0.5">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                locale === code
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {LOCALE_NAMES[code]}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
