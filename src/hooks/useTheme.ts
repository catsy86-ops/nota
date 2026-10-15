import { useCallback, useSyncExternalStore } from "react";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { isEffectEnabled } from "@/lib/effectsSettings";
import { SKIN_SCHEME, SKIN_THEME_COLOR, setSkin, skinStore, useSkin, type Skin } from "@/lib/skins";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "kaczy-theme"; // stores ThemeMode ("system" | "light" | "dark") — legacy values also accepted
const TRANSITION_CLASS = "theme-transition";
const REVEAL_CLASS = "theme-reveal";
const TRANSITION_MS = 350;
const REVEAL_MS = 620;

function readStored(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === "dark" || raw === "light" || raw === "system") return raw;
  } catch { /* ignore */ }
  return "system";
}

const mql = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const systemPrefersDark = () => !!mql?.matches;

/** Czysta decyzja: czy zmianę motywu animować przez View Transitions API. */
export function shouldUseViewTransition(o: { supported: boolean; reduced: boolean; enabled: boolean; changed: boolean }): boolean {
  return o.supported && o.enabled && !o.reduced && o.changed;
}

/** Ciemno czy jasno: styl z własnym schematem wygrywa z przełącznikiem jasny/ciemny. */
export function resolveDark(mode: ThemeMode, skin: Skin, systemDark: boolean): boolean {
  const scheme = SKIN_SCHEME[skin];
  if (scheme) return scheme === "dark";
  return mode === "system" ? systemDark : mode === "dark";
}

/** Promień koła, które z punktu (x, y) zakrywa cały ekran. */
export function revealRadius(x: number, y: number, w: number, h: number): number {
  return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));
}

type ViewTransition = { ready: Promise<void>; finished: Promise<void> };
type DocWithVT = Document & { startViewTransition?: (cb: () => void) => ViewTransition };

// Ostatnie dotknięcie/kliknięcie — z tego miejsca rozlewa się nowy motyw.
let lastPointer: { x: number; y: number; t: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => { lastPointer = { x: e.clientX, y: e.clientY, t: Date.now() }; }, { capture: true, passive: true });
}

let lastApplied: { dark: boolean; skin: Skin } | null = null;

function applyAppearance(dark: boolean, skin: Skin) {
  if (typeof document === "undefined") return;
  if (lastApplied && lastApplied.dark === dark && lastApplied.skin === skin) return;
  const root = document.documentElement;
  const changed = lastApplied !== null;
  lastApplied = { dark, skin };
  const paint = () => {
    root.classList.toggle("dark", dark);
    root.dataset.skin = skin;
    root.style.colorScheme = dark ? "dark" : "light";
    // Pasek stanu telefonu / okna PWA w kolorze stylu; Zeszyt: ciemny nie świeci bursztynem.
    const color = skin === "zeszyt" && dark ? "#0f0d10" : SKIN_THEME_COLOR[skin];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  };
  const reduced = isMotionReduced();
  const doc = document as DocWithVT;
  const vt = shouldUseViewTransition({
    supported: typeof doc.startViewTransition === "function",
    reduced,
    enabled: isEffectEnabled("themeFade"),
    changed,
  });
  if (vt) {
    // Nowy motyw rozlewa się kołem od miejsca kliknięcia (albo od góry ekranu).
    const recent = lastPointer && Date.now() - lastPointer.t < 1500 ? lastPointer : null;
    const x = recent?.x ?? window.innerWidth / 2;
    const y = recent?.y ?? 0;
    root.classList.add(REVEAL_CLASS);
    const t = doc.startViewTransition!(paint);
    t.ready.then(() => {
      const r = revealRadius(x, y, window.innerWidth, window.innerHeight);
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => { /* przejście przerwane — stan docelowy i tak ustawiony */ });
    t.finished.finally(() => root.classList.remove(REVEAL_CLASS));
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

// Jeden stan dla całej aplikacji — wcześniej każdy `useTheme()` trzymał własną kopię
// i nagłówek nie wiedział o zmianie zrobionej w Ustawieniach.
let mode: ThemeMode = readStored();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

function applyCurrent() {
  applyAppearance(resolveDark(mode, skinStore.get(), systemPrefersDark()), skinStore.get());
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  applyCurrent();
  emit();
}

if (typeof window !== "undefined") {
  applyCurrent();
  skinStore.subscribe(applyCurrent);
  mql?.addEventListener?.("change", () => { applyCurrent(); emit(); });
  window.addEventListener("storage", (e) => {
    if (e.key !== THEME_KEY && e.key !== null) return;
    mode = readStored();
    applyCurrent();
    emit();
  });
}

export function useTheme() {
  const currentMode = useSyncExternalStore(subscribe, () => mode, () => "system" as ThemeMode);
  const systemDark = useSyncExternalStore(subscribe, systemPrefersDark, () => false);
  const skin = useSkin();
  const dark = resolveDark(currentMode, skin, systemDark);

  const setMode = useCallback((m: ThemeMode) => setThemeMode(m), []);
  /** Jasny ↔ ciemny. Styl z własnym schematem wraca do Zeszytu w przeciwnej jasności. */
  const toggle = useCallback(() => {
    const currentDark = resolveDark(mode, skinStore.get(), systemPrefersDark());
    mode = currentDark ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
    if (skinStore.get() !== "zeszyt") setSkin("zeszyt");
    else applyCurrent();
    emit();
  }, []);

  return { mode: currentMode, dark, skin, setMode, setSkin, toggle };
}
