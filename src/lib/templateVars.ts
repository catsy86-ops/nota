/**
 * Zmienne w szablonach notatek: `{{data}}`, `{{dzień}}`, `{{godzina}}` itd.
 * Podstawiane w chwili tworzenia notatki; nieznana zmienna zostaje bez zmian,
 * żeby literówka była widoczna, a nie znikała po cichu.
 */

export interface TemplateVariable {
  name: string;
  description: string;
}

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { name: "data", description: "np. poniedziałek, 12 października" },
  { name: "data_iso", description: "np. 2026-10-12" },
  { name: "dzień", description: "dzień tygodnia" },
  { name: "godzina", description: "np. 14:30" },
  { name: "jutro", description: "data jutrzejsza" },
  { name: "wczoraj", description: "data wczorajsza" },
  { name: "tydzień", description: "numer tygodnia w roku" },
  { name: "rok", description: "np. 2026" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function longDate(d: Date): string {
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

/** Numer tygodnia ISO 8601. */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
}

function values(now: Date): Record<string, string> {
  const shift = (days: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return {
    "data": longDate(now),
    "data_iso": `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    "dzień": now.toLocaleDateString("pl-PL", { weekday: "long" }),
    "godzina": `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    "jutro": longDate(shift(1)),
    "wczoraj": longDate(shift(-1)),
    "tydzień": String(isoWeek(now)),
    "rok": String(now.getFullYear()),
  };
}

/** Podstawia zmienne w tekście; wielkość liter i spacje w klamrach nie mają znaczenia. */
export function renderTemplate(text: string, now: Date = new Date()): string {
  const v = values(now);
  return text.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (whole, name: string) => v[name.toLowerCase()] ?? whole);
}
