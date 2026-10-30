import { applyAppearanceValues, snapshotAppearance } from "@/lib/appearanceCode";

/**
 * Zestawy wyglądu jednym stuknięciem (plan motywów 2026-10-30, 1.3). Zestaw to wartości kluczy z
 * `APPEARANCE_KEYS`, zapisane tak, jak trzyma je localStorage (JSON). Gotowe zestawy zmieniają tylko
 * swoje klucze — reszta (akcent, krój, układ) zostaje. Własne sloty zapisują cały wygląd.
 */

export interface AppearancePreset {
  id: "site" | "night";
  label: string;
  desc: string;
  values: Record<string, string>;
}

export const PRESETS: readonly AppearancePreset[] = [
  {
    id: "site",
    label: "Budowa",
    desc: "Odblask, tryb budowa, gładkie tło, wyraźne ramki, tekst 125%, bez ruchu i poświaty.",
    values: {
      "kaczy.skin.v1": JSON.stringify("odblask"),
      "kaczy.siteMode.v1": JSON.stringify("on"),
      "kaczy.backdrop.v1": JSON.stringify("plain"),
      "kaczy.frames.v1": JSON.stringify("strong"),
      "kaczy.textSize.v1": JSON.stringify(3),
      "kaczy.glow.v1": JSON.stringify({ strength: "off", color: "theme" }),
      "kaczy.motion.v1": JSON.stringify("reduced"),
    },
  },
  {
    id: "night",
    label: "Noc",
    desc: "Ciemna Zorza, ciche tło, łagodna poświata. Do czytania wieczorem.",
    values: {
      "kaczy.skin.v1": JSON.stringify("zorza"),
      "kaczy.skinScheme.v1": JSON.stringify({ zorza: "dark" }),
      "kaczy.backdrop.v1": JSON.stringify("quiet"),
      "kaczy.glow.v1": JSON.stringify({ strength: "soft", color: "theme" }),
      "kaczy.siteMode.v1": JSON.stringify("off"),
    },
  },
];

export const SLOT_COUNT = 3;
const slotKey = (n: number) => `kaczy.appearance.slot.${n}.v1`;

/** Zapisany wygląd z miejsca 1–3; `null` = puste albo nieczytelne. */
export function readSlot(n: number): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(slotKey(n));
    if (!raw) return null;
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const out: Record<string, string> = {};
    for (const [k, x] of Object.entries(v)) if (typeof x === "string") out[k] = x;
    return out;
  } catch {
    return null;
  }
}

/** Zapisuje bieżący wygląd w miejscu `n`. */
export function saveSlot(n: number): void {
  try { localStorage.setItem(slotKey(n), JSON.stringify(snapshotAppearance())); } catch { /* prywatne okno */ }
}

/**
 * Stosuje zestaw bez przeładowania i zwraca wartości sprzed zmiany (do „Cofnij”). Gotowy zestaw nadpisuje
 * tylko swoje klucze; własny slot wraca cały (`full`), więc klucze spoza zapisu wracają do domyślnych.
 */
export function applyValues(values: Record<string, string>, { full }: { full: boolean }): Record<string, string> {
  const before = snapshotAppearance();
  applyAppearanceValues(values, { replace: full });
  return before;
}
