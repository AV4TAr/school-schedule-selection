"use client";

import { useI18n } from "@/lib/i18n/context";
import { THEMES, useTheme, type Theme } from "@/lib/theme";

const ICON: Record<Theme, string> = { light: "☀", dark: "☾", system: "◐" };

export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label={t.theme.label}
      className="flex items-center gap-0.5 rounded-[var(--r-sm)] border border-line bg-raised p-0.5"
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setTheme(option)}
          aria-pressed={theme === option}
          title={t.theme[option]}
          className={`rounded-[3px] px-1.5 py-0.5 text-xs leading-none transition ${
            theme === option
              ? "bg-surface text-foreground shadow-[var(--e-1)]"
              : "text-faint hover:text-foreground"
          }`}
        >
          <span aria-hidden>{ICON[option]}</span>
          <span className="sr-only">{t.theme[option]}</span>
        </button>
      ))}
    </div>
  );
}
