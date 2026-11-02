import { applyAppearanceValues, snapshotAppearance } from "@/lib/appearanceCode";
import { SKIN_META } from "@/lib/skinGallery";
import { TEXT_SIZE_STEPS } from "@/lib/textSize";
import type { Skin } from "@/lib/skins";

/**
 * Zestawy wyglądu jednym stuknięciem (plan motywów 2026-10-30, 1.3). Zestaw to wartości kluczy z
 * `APPEARANCE_KEYS`, zapisane tak, jak trzyma je localStorage (JSON). Gotowe zestawy zmieniają tylko
 * swoje klucze — reszta (akcent, krój, układ) zostaje. Własne sloty zapisują cały wygląd.
 */

export interface AppearancePreset {
  id: "site" | "night" | "read" | "battery";
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
  {
    id: "read",
    label: "Czytanie",
    desc: "Tekst 112,5%, ciche tło, zwykłe ramki, bez poświaty i ruchu. Do dłuższych notatek.",
    values: {
      "kaczy.textSize.v1": JSON.stringify(2),
      "kaczy.backdrop.v1": JSON.stringify("quiet"),
      "kaczy.frames.v1": JSON.stringify("normal"),
      "kaczy.glow.v1": JSON.stringify({ strength: "off", color: "theme" }),
      "kaczy.motion.v1": JSON.stringify("reduced"),
      "kaczy.siteMode.v1": JSON.stringify("off"),
    },
  },
  {
    id: "battery",
    label: "Oszczędny",
    desc: "Ciemny Zeszyt z czarnym tłem, bez ruchu, poświaty i wzoru tła — mniej prądu na ekranach OLED.",
    values: {
      "kaczy.skin.v1": JSON.stringify("zeszyt"),
      "kaczy-theme": "dark",
      "kaczy.oled.v1": JSON.stringify(true),
      "kaczy.backdrop.v1": JSON.stringify("plain"),
      "kaczy.glow.v1": JSON.stringify({ strength: "off", color: "theme" }),
      "kaczy.motion.v1": JSON.stringify("reduced"),
      "kaczy.siteMode.v1": JSON.stringify("off"),
    },
  },
];

/**
 * Czy zestaw jest teraz włączony: każdy jego klucz ma w localStorage tę samą wartość. Porównanie po
 * sparsowanym JSON (kolejność pól obiektu bez znaczenia); brak klucza = nie pasuje.
 */
export function isPresetActive(values: Record<string, string>, read: (k: string) => string | null = safeRead): boolean {
  return Object.entries(values).every(([k, v]) => sameJson(read(k), v));
}

function safeRead(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

function sameJson(a: string | null, b: string): boolean {
  if (a === null) return false;
  if (a === b) return true;
  try { return JSON.stringify(sortKeys(JSON.parse(a))) === JSON.stringify(sortKeys(JSON.parse(b))); } catch { return false; }
}

function sortKeys(v: unknown): unknown {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, sortKeys(x)]));
}

/** Krótki opis zapisanego zestawu („Zorza, ciemny · tekst 125%”) — żeby „Mój 1” mówiło, co w nim jest. */
export function slotSummary(values: Record<string, string>): string {
  const parse = (k: string): unknown => { try { return values[k] === undefined ? undefined : JSON.parse(values[k]); } catch { return values[k]; } };
  const skin = parse("kaczy.skin.v1");
  const name = typeof skin === "string" && skin in SKIN_META ? SKIN_META[skin as Skin].label : "Zeszyt";
  const scheme = skin === "zeszyt" || skin === undefined ? values["kaczy-theme"] : (parse("kaczy.skinScheme.v1") as Record<string, string> | undefined)?.[skin as string];
  const parts = [scheme === "dark" ? `${name}, ciemny` : scheme === "light" ? `${name}, jasny` : name];
  const size = parse("kaczy.textSize.v1");
  if (typeof size === "number" && TEXT_SIZE_STEPS[size] !== undefined && size !== 1) parts.push(`tekst ${String(TEXT_SIZE_STEPS[size]).replace(".", ",")}%`);
  if (parse("kaczy.motion.v1") === "reduced") parts.push("bez ruchu");
  return parts.join(" · ");
}

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
