import { useCallback, useEffect, useState } from "react";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { isEffectEnabled } from "@/lib/effectsSettings";

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

/** Czysta decyzja: czy zmianę motywu animować przez View Transitions API. */
export function shouldUseViewTransition(o: { supported: boolean; reduced: boolean; enabled: boolean; changed: boolean }): boolean {
  return o.supported && o.enabled && !o.reduced && o.changed;
}

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => unknown };

let lastApplied: boolean | null = null;

function applyDark(dark: boolean) {
  const root = document.documentElement;
  const changed = lastApplied !== null && lastApplied !== dark;
  lastApplied = dark;
  const paint = () => {
    root.classList.toggle("dark", dark);
    root.style.colorScheme = dark ? "dark" : "light";
    // Pasek stanu telefonu / okna PWA: ciemny motyw nie świeci bursztynem.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0f0d10" : "#f0b429");
  };
  const reduced = isMotionReduced();
  const vt = shouldUseViewTransition({
    supported: typeof (document as DocWithVT).startViewTransition === "function",
    reduced,
    enabled: isEffectEnabled("themeFade"),
    changed,
  });
  if (vt) {
    // Płynne przejście całej strony; stan docelowy ustawiany synchronicznie w callbacku.
    (document as DocWithVT).startViewTransition!(paint);
    return;
  }
  if (reduced || !changed) {
    // Pierwsze malowanie albo reduced motion: natychmiast, bez animacji.
    paint();
    return;
  }
  // Fallback bez View Transitions: krótkie przejścia CSS na jeden takt.
  root.classList.add(TRANSITION_CLASS);
  paint();
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
