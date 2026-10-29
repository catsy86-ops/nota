import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Poświaty (Ustawienia → Wygląd → „Poświata”): siła i kolor świecenia przycisków głównych (FAB,
 * „Zapisz”) oraz zaznaczonej notatki. Domyślne wartości nic nie nadpisują, więc skórki zostają jak były.
 *
 * - `--glow-mul` mnoży tylko halo (rozmyta część cienia). Obwódka zaznaczenia notatki zostaje pełna,
 *   więc przy „Wyłączona” zaznaczona notatka dalej jest widoczna.
 * - `--glow-color` zmienia barwę poświaty notatki (domyślnie kolor sezonowy).
 * - `--glow-primary` (przyciski) nadpisujemy tylko przy zmianie siły albo koloru.
 */

export type GlowStrength = "off" | "soft" | "normal" | "strong";
export type GlowColorId = "theme" | "amber" | "blue" | "green" | "violet" | "rose";

export interface GlowLook {
  strength: GlowStrength;
  color: GlowColorId;
}

export const DEFAULT_GLOW_LOOK: GlowLook = { strength: "normal", color: "theme" };

export const GLOW_STRENGTH: Record<GlowStrength, { label: string; mul: number }> = {
  off: { label: "Wyłączona", mul: 0 },
  soft: { label: "Delikatna", mul: 0.5 },
  normal: { label: "Zwykła", mul: 1 },
  strong: { label: "Mocna", mul: 1.6 },
};

/** Barwa poświaty; „Motyw” = kolor sezonowy notatek i akcent przycisków. */
export const GLOW_COLORS: Record<GlowColorId, { label: string; hex: string | null }> = {
  theme: { label: "Motyw", hex: null },
  amber: { label: "Bursztyn", hex: "#f59e0b" },
  blue: { label: "Błękit", hex: "#3b82f6" },
  green: { label: "Zieleń", hex: "#22c55e" },
  violet: { label: "Fiolet", hex: "#8b5cf6" },
  rose: { label: "Róż", hex: "#f43f5e" },
};

const isStrength = (v: unknown): v is GlowStrength => typeof v === "string" && v in GLOW_STRENGTH;
const isColor = (v: unknown): v is GlowColorId => typeof v === "string" && v in GLOW_COLORS;

/** Cień przycisku głównego (FAB) dla danej siły i barwy; `null` = zostaje cień skórki. */
export function fabGlowValue(look: GlowLook): string | null {
  if (look.strength === "normal" && look.color === "theme") return null;
  if (look.strength === "off") return "none";
  const hex = GLOW_COLORS[look.color].hex;
  const base = hex ?? "var(--primary)";
  return `0 10px 28px -8px color-mix(in srgb, ${base} calc(50% * ${GLOW_STRENGTH[look.strength].mul}), transparent)`;
}

function applyToDom(look: GlowLook) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (look.strength === "normal") style.removeProperty("--glow-mul");
  else style.setProperty("--glow-mul", String(GLOW_STRENGTH[look.strength].mul));
  const hex = GLOW_COLORS[look.color].hex;
  if (hex) style.setProperty("--glow-color", hex);
  else style.removeProperty("--glow-color");
  const fab = fabGlowValue(look);
  if (fab) style.setProperty("--glow-primary", fab);
  else style.removeProperty("--glow-primary");
}

const store = createPersistedStore<GlowLook>("kaczy.glow.v1", DEFAULT_GLOW_LOOK, {
  merge: (defaults, stored) => ({
    strength: isStrength(stored?.strength) ? stored.strength : defaults.strength,
    color: isColor(stored?.color) ? stored.color : defaults.color,
  }),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useGlowLook = () => store.use();
export const setGlowStrength = (strength: GlowStrength) => store.set({ ...store.get(), strength });
export const setGlowColor = (color: GlowColorId) => store.set({ ...store.get(), color });
