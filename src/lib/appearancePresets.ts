import { applyAppearanceValues, snapshotAppearance } from "@/lib/appearanceCode";
import { SKIN_META } from "@/lib/skinGallery";
import { TEXT_SIZE_STEPS } from "@/lib/textSize";
import type { Skin } from "@/lib/skins";
import { APPEARANCE, appearanceSlotKey } from "@/lib/storage/names";

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
      [APPEARANCE.skin]: JSON.stringify("odblask"),
      [APPEARANCE.siteMode]: JSON.stringify("on"),
      [APPEARANCE.backdrop]: JSON.stringify("plain"),
      [APPEARANCE.frames]: JSON.stringify("strong"),
      [APPEARANCE.textSize]: JSON.stringify(3),
      [APPEARANCE.glow]: JSON.stringify({ strength: "off", color: "theme" }),
      [APPEARANCE.motion]: JSON.stringify("reduced"),
    },
  },
  {
    id: "night",
    label: "Noc",
    desc: "Ciemna Zorza, ciche tło, łagodna poświata. Do czytania wieczorem.",
    values: {
      [APPEARANCE.skin]: JSON.stringify("zorza"),
      [APPEARANCE.skinScheme]: JSON.stringify({ zorza: "dark" }),
      [APPEARANCE.backdrop]: JSON.stringify("quiet"),
      [APPEARANCE.glow]: JSON.stringify({ strength: "soft", color: "theme" }),
      [APPEARANCE.siteMode]: JSON.stringify("off"),
    },
  },
  {
    id: "read",
    label: "Czytanie",
    desc: "Tekst 112,5%, ciche tło, zwykłe ramki, bez poświaty i ruchu. Do dłuższych notatek.",
    values: {
      [APPEARANCE.textSize]: JSON.stringify(2),
      [APPEARANCE.backdrop]: JSON.stringify("quiet"),
      [APPEARANCE.frames]: JSON.stringify("normal"),
      [APPEARANCE.glow]: JSON.stringify({ strength: "off", color: "theme" }),
      [APPEARANCE.motion]: JSON.stringify("reduced"),
      [APPEARANCE.siteMode]: JSON.stringify("off"),
    },
  },
  {
    id: "battery",
    label: "Oszczędny",
    desc: "Ciemny Zeszyt z czarnym tłem, bez ruchu, poświaty i wzoru tła — mniej prądu na ekranach OLED.",
    values: {
      [APPEARANCE.skin]: JSON.stringify("zeszyt"),
      [APPEARANCE.theme]: "dark",
      [APPEARANCE.oled]: JSON.stringify(true),
      [APPEARANCE.backdrop]: JSON.stringify("plain"),
      [APPEARANCE.glow]: JSON.stringify({ strength: "off", color: "theme" }),
      [APPEARANCE.motion]: JSON.stringify("reduced"),
      [APPEARANCE.siteMode]: JSON.stringify("off"),
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
  const skin = parse(APPEARANCE.skin);
  const name = typeof skin === "string" && skin in SKIN_META ? SKIN_META[skin as Skin].label : "Zeszyt";
  const scheme = skin === "zeszyt" || skin === undefined ? values[APPEARANCE.theme] : (parse(APPEARANCE.skinScheme) as Record<string, string> | undefined)?.[skin as string];
  const parts = [scheme === "dark" ? `${name}, ciemny` : scheme === "light" ? `${name}, jasny` : name];
  const size = parse(APPEARANCE.textSize);
  if (typeof size === "number" && TEXT_SIZE_STEPS[size] !== undefined && size !== 1) parts.push(`tekst ${String(TEXT_SIZE_STEPS[size]).replace(".", ",")}%`);
  if (parse(APPEARANCE.motion) === "reduced") parts.push("bez ruchu");
  return parts.join(" · ");
}

export const SLOT_COUNT = 3;
const slotKey = appearanceSlotKey;

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
