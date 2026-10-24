import { shiftKey } from "./report";

/** Okres raportu jednym stuknięciem; `custom` = daty wybrane ręcznie. */
export type ReportPreset = "today" | "yesterday" | "week" | "month" | "prev-month" | "custom";

export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "today", label: "Dziś" },
  { value: "yesterday", label: "Wczoraj" },
  { value: "week", label: "7 dni" },
  { value: "month", label: "Ten miesiąc" },
  { value: "prev-month", label: "Poprzedni miesiąc" },
  { value: "custom", label: "Wybierz" },
];

const FIXED = ["today", "yesterday", "week", "month", "prev-month"] as const;

/**
 * Zakres dni (`RRRR-MM-DD`, oba końce włącznie) dla presetu, liczony od `today`.
 * „Poprzedni miesiąc” to cały miesiąc kalendarzowy — rozliczenie z szefem za zamknięty miesiąc.
 */
export function presetRange(p: Exclude<ReportPreset, "custom">, today: string): [string, string] {
  if (p === "today") return [today, today];
  if (p === "yesterday") { const y = shiftKey(today, -1); return [y, y]; }
  if (p === "week") return [shiftKey(today, -6), today];
  const first = `${today.slice(0, 8)}01`;
  if (p === "month") return [first, today];
  const last = shiftKey(first, -1);
  return [`${last.slice(0, 8)}01`, last];
}

/** Który preset daje dokładnie ten zakres; inny zakres = `custom`. */
export function presetOf(from: string, to: string, today: string): ReportPreset {
  for (const p of FIXED) {
    const [a, b] = presetRange(p, today);
    if (a === from && b === to) return p;
  }
  return "custom";
}
