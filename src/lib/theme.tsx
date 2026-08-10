"use client";

import { useCallback, useSyncExternalStore } from "react";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** Light unless the user says otherwise — the app is used in daylight. */
export const DEFAULT_THEME: Theme = "light";

export const THEME_STORAGE_KEY = "schedule.theme";

/**
 * Runs before first paint to stamp the stored theme on <html>, so a dark-theme
 * user never sees a flash of light. Kept as a string because it has to be
 * inlined into the document head, ahead of React.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="dark"||t==="system"||t==="light"){document.documentElement.dataset.theme=t}else{document.documentElement.dataset.theme=${JSON.stringify(
  DEFAULT_THEME,
)}}}catch(e){}})();`;

/**
 * The theme lives on the <html> element and in localStorage, both external to
 * React, so it is read through `useSyncExternalStore`. The server always
 * reports the default; the init script has already applied the real value by
 * the time hydration runs.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyToDocument(read());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function read(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return (THEMES as readonly string[]).includes(stored ?? "")
    ? (stored as Theme)
    : DEFAULT_THEME;
}

function getSnapshot(): Theme {
  // Trust the attribute the init script set; fall back to storage.
  const attr = document.documentElement.dataset.theme;
  return (THEMES as readonly string[]).includes(attr ?? "") ? (attr as Theme) : read();
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyToDocument(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyToDocument(next);
    for (const listener of listeners) listener();
  }, []);

  return { theme, setTheme };
}
