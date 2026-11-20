import type { View } from "@/lib/types/view";

/** Szkice pustych widoków (ścieżki SVG w viewBox 120x84), rysowane „długopisem”. */
export const EMPTY_GLYPHS: Partial<Record<View, string[]>> = {
  archive: ["M30 30 H90 V62 H30 Z", "M24 20 H96 V30 H24 Z", "M50 42 H70"],
  trash: ["M40 30 H80 L76 66 H44 Z", "M34 30 H86", "M52 22 H68 V30", "M52 40 V58", "M68 40 V58"],
  reminders: ["M60 18 C46 18 42 30 42 42 L36 54 H84 L78 42 C78 30 74 18 60 18 Z", "M54 60 C55 66 65 66 66 60"],
  calendar: ["M30 22 H90 V66 H30 Z", "M30 36 H90", "M44 16 V26", "M76 16 V26"],
  today: ["M72 42 A12 12 0 1 1 71.9 42 Z", "M60 16 V22", "M60 62 V68", "M34 42 H40", "M80 42 H86", "M42 24 L46 28", "M78 60 L74 56", "M78 24 L74 28", "M42 60 L46 56"],
  week: ["M30 22 H90 V66 H30 Z", "M30 36 H90", "M40 50 H80", "M44 16 V26", "M76 16 V26"],
  label: ["M30 22 H64 L90 44 L68 66 L30 40 Z", "M46 32 H46.1"],
  // Rzut z dwoma pomieszczeniami i trasą rury (nowy plan 2.5: Plany bez samego tekstu).
  plans: ["M24 18 H96 V66 H24 Z", "M60 18 V66", "M32 58 H54 V32 H88", "M88 28 V36"],
  // Pusta kartka z pierwszą linią i długopisem — zamiast wordmarku (decyzja: jeden znak).
  notes: ["M28 18 H92 V66 H28 Z", "M42 32 H78", "M42 44 H72", "M76 62 L92 46"],
};

/** Dziennik budowy bez wpisów: kartka zeszytu z marginesem, wiersze tekstu i długopis. */
export const JOURNAL_GLYPH = ["M28 16 H92 V64 H28 Z", "M42 16 V64", "M52 30 H82", "M52 40 H78", "M52 50 H70", "M76 60 L92 44"];

/** W5.4: Klienci bez wpisów — wizytówka z sylwetką. */
export const CLIENTS_GLYPH = ["M26 22 H94 V64 H26 Z", "M48 38 A7 7 0 1 1 47.9 38 Z", "M36 58 C36 48 60 48 60 58", "M68 34 H86", "M68 44 H82", "M68 54 H78"];

/** W5.4: Grafik bez rodzajów zmian — trzy kafelki zmian, ostatni z plusem. */
export const SHIFT_TYPES_GLYPH = ["M28 24 H54 V40 H28 Z", "M64 24 H92 V40 H64 Z", "M28 50 H54 V66 H28 Z", "M78 50 V66", "M70 58 H86"];

/** W5.4: Ćwiczenia bez odżywek — kapsułka. */
export const SUPPLEMENTS_GLYPH = ["M40 52 L66 26 A10 10 0 0 1 80 40 L54 66 A10 10 0 0 1 40 52 Z", "M53 39 L67 53"];

export function hasEmptyIllustration(view: View): boolean {
  return view in EMPTY_GLYPHS;
}
