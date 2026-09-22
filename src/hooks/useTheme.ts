import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "kaczy-theme"; // stores ThemeMode ("system" | "light" | "dark") — legacy values also accepted
const TRANSITION_CLASS = "theme-transition";
const TRANSITION_MS = 350;

function readStored(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light" || raw === "system") return raw;
  } catch { /* ignore */ }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDark(dark: boolean) {
  const root = document.documentElement;
  // enable transition for one tick so we don't animate on first paint
  root.classList.add(TRANSITION_CLASS);
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  window.setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readStored);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Track system preference changes
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const dark = mode === "system" ? systemDark : mode === "dark";

  // Apply to DOM + persist
  useEffect(() => {
    applyDark(dark);
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
  }, [dark, mode]);

  const setMode = useCallback((m: ThemeMode) => setModeState(m), []);
  const toggle = useCallback(() => {
    setModeState((prev) => {
      const currentDark = prev === "system" ? systemPrefersDark() : prev === "dark";
      return currentDark ? "light" : "dark";
    });
  }, []);

  return { mode, dark, setMode, toggle };
}
