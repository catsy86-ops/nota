import { useCallback, useSyncExternalStore } from "react";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { isEffectEnabled } from "@/lib/effectsSettings";
import { SKIN_SCHEME, SKIN_THEME_COLOR, SKIN_THEME_COLOR_ALT, setSkin, skinStore, useSkin, type Skin } from "@/lib/skins";
import { setSkinScheme, skinSchemeStore, type SkinSchemeMap } from "@/lib/skinScheme";
import { applySkinFavicon } from "@/lib/skinFavicon";

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

/**
 * Ciemno czy jasno. Zeszyt słucha wspólnego przełącznika (`mode`); każdy inny styl ma własny wybór
 * (`kaczy.skinScheme.v1`, plan motywów 4.1), a bez wyboru — schemat, w którym powstał (`SKIN_SCHEME`).
 */
export function resolveDark(mode: ThemeMode, skin: Skin, systemDark: boolean, skinModes: SkinSchemeMap = skinSchemeStore.get()): boolean {
  const pref = skin === "zeszyt" ? mode : skinModes[skin] ?? SKIN_SCHEME[skin]!;
  return pref === "system" ? systemDark : pref === "dark";
}

/** Wybór jasności dla stylu, tak jak pokazuje go przełącznik w Ustawieniach. */
export function schemePrefFor(skin: Skin, mode: ThemeMode, skinModes: SkinSchemeMap = skinSchemeStore.get()): ThemeMode {
  return skin === "zeszyt" ? mode : skinModes[skin] ?? SKIN_SCHEME[skin]!;
}

/** Promień koła, które z punktu (x, y) zakrywa cały ekran. */
export function revealRadius(x: number, y: number, w: number, h: number): number {
  return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y)));
}

/**
 * Kształt odsłonięcia nowego stylu (plan motywów 2.4) jako para `clip-path` [od, do]. Przy zmianie na
 * Plan arkusz rozwija się od lewej, Miedź nagrzewa się od rury z prawej, Matryca spływa z góry,
 * a Hydraulika napełnia się od dołu. Zeszyt, Neon, Zorza i sama zmiana jasności — koło od kliknięcia.
 */
export function revealClip(skin: Skin | null, x: number, y: number, w: number, h: number): [string, string] {
  switch (skin) {
    case "plan": return ["inset(0 100% 0 0)", "inset(0 0 0 0)"];
    case "miedz": return [`circle(0px at ${w}px ${h}px)`, `circle(${Math.ceil(Math.hypot(w, h))}px at ${w}px ${h}px)`];
    case "matrix": return ["inset(0 0 100% 0)", "inset(0 0 0 0)"];
    case "hydraulika": return ["inset(100% 0 0 0)", "inset(0 0 0 0)"];
    default: {
      const r = revealRadius(x, y, w, h);
      return [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`];
    }
  }
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
  const skinChanged = lastApplied !== null && lastApplied.skin !== skin;
  lastApplied = { dark, skin };
  const paint = () => {
    root.classList.toggle("dark", dark);
    root.dataset.skin = skin;
    root.style.colorScheme = dark ? "dark" : "light";
    // Pasek stanu telefonu / okna PWA w kolorze stylu; Zeszyt: ciemny nie świeci bursztynem.
    // #15110e = `--background` ciemnego Zeszytu (hsl 26 20% 7%), nie chłodny fiolet.
    // Drugi schemat stylu (4.1) ma własny kolor paska (`SKIN_THEME_COLOR_ALT`).
    const native = SKIN_SCHEME[skin];
    const color = skin === "zeszyt" ? (dark ? "#15110e" : SKIN_THEME_COLOR.zeszyt)
      : (dark === (native === "dark") ? SKIN_THEME_COLOR[skin] : SKIN_THEME_COLOR_ALT[skin]);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    applySkinFavicon(skin);
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
    // Nowy motyw rozlewa się kołem od miejsca kliknięcia (albo od góry ekranu); część stylów ma własny kształt (`revealClip`).
    const recent = lastPointer && Date.now() - lastPointer.t < 1500 ? lastPointer : null;
    const x = recent?.x ?? window.innerWidth / 2;
    const y = recent?.y ?? 0;
    root.classList.add(REVEAL_CLASS);
    const t = doc.startViewTransition!(paint);
    t.ready.then(() => {
      root.animate(
        { clipPath: revealClip(skinChanged ? skin : null, x, y, window.innerWidth, window.innerHeight) },
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
  skinSchemeStore.subscribe(() => { applyCurrent(); emit(); });
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
  const skinModes = useSyncExternalStore(skinSchemeStore.subscribe, skinSchemeStore.get, skinSchemeStore.get);
  const dark = resolveDark(currentMode, skin, systemDark, skinModes);
  /** Wybór jasności bieżącego stylu (Zeszyt: wspólny przełącznik). */
  const schemeMode = schemePrefFor(skin, currentMode, skinModes);

  /** Jasność bieżącego stylu: w Zeszycie wspólny przełącznik, w innych stylach — wybór tego stylu. */
  const setMode = useCallback((m: ThemeMode) => {
    const s = skinStore.get();
    if (s === "zeszyt") setThemeMode(m);
    else setSkinScheme(s, m);
  }, []);
  /** Jasny ↔ ciemny w bieżącym stylu (od 4.1 każdy styl ma oba schematy — bez przełączania na Zeszyt). */
  const toggle = useCallback(() => {
    const s = skinStore.get();
    const next: ThemeMode = resolveDark(mode, s, systemPrefersDark()) ? "light" : "dark";
    if (s === "zeszyt") setThemeMode(next);
    else setSkinScheme(s, next);
  }, []);

  return { mode: currentMode, schemeMode, dark, skin, setMode, setSkin, toggle };
}
