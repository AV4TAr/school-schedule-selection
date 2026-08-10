"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  LOCALES,
  interpolate,
  type Dictionary,
  type Locale,
} from "./dictionaries";
import { formatDuration, formatRange, formatTime } from "../time";

const STORAGE_KEY = "schedule.locale";

/**
 * The chosen locale lives in localStorage, which makes it an external store.
 * Reading it through `useSyncExternalStore` lets the server and the first
 * client render agree on the default, then swap to the stored preference
 * immediately after hydration without a mismatch warning.
 */
const listeners = new Set<() => void>();
let cached: Locale | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Keep other tabs of the same app in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Locale {
  if (cached === null) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    cached =
      stored && (LOCALES as readonly string[]).includes(stored)
        ? (stored as Locale)
        : DEFAULT_LOCALE;
  }
  return cached;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

function writeLocale(next: Locale) {
  cached = next;
  window.localStorage.setItem(STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
  /** Fill {placeholders} in a dictionary string. */
  fmt: (template: string, values: Record<string, string | number>) => string;
  time: (min: number) => string;
  range: (startMin: number, endMin: number) => string;
  duration: (minutes: number) => string;
  weekday: (day: number, style?: "long" | "short") => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const t = DICTIONARIES[locale];
    return {
      locale,
      setLocale: writeLocale,
      t,
      fmt: interpolate,
      time: (min) => formatTime(min, locale),
      range: (startMin, endMin) => formatRange(startMin, endMin, locale),
      duration: formatDuration,
      weekday: (day, style = "long") => t.weekdays[style][day] ?? "",
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used inside a LocaleProvider");
  return ctx;
}
