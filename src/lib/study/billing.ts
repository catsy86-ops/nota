/**
 * Sposób rozliczenia budowy (H3.1, plan 2026-10-29): godziny (stawka w karcie, `SiteCard.rate`),
 * od punktu (stawka domyślna i stawki na typ punktu — decyzja H-4) i ryczałt (kwota za całość
 * i/lub za etapy). Sposoby można łączyć. Czyste dane; zapis w Yjs w `yBilling.ts`, akcje
 * w `billingStore.ts`. Pieniądze są w osobnej mapie, nie w karcie budowy (zasada 4 planu).
 */

export const BILLING_MODES = ["hours", "points", "lump"] as const;
export type BillingMode = (typeof BILLING_MODES)[number];
export const MODE_LABEL: Readonly<Record<BillingMode, string>> = { hours: "Godziny", points: "Od punktu", lump: "Ryczałt" };

/** Budowa bez zapisanego sposobu: same godziny, jak przed H3.1. */
export const DEFAULT_MODES: readonly BillingMode[] = ["hours"];

/** Najwyższa kwota (zł) — ponad to to raczej literówka. */
export const AMOUNT_MAX = 10_000_000;

export interface SiteBilling {
  modes: BillingMode[];
  /** Stawka za punkt, gdy typ nie ma własnej (zł). */
  pointRate?: number;
  /** Stawki na typ punktu (`points.ts` → `POINT_TYPES[].id`). */
  typeRates: Record<string, number>;
  /** Ryczałt za całą budowę (zł). */
  lump?: number;
  /** Ryczałt za etap: id etapu (`stages.ts`) → kwota. */
  stageAmounts: Record<string, number>;
}

/** Kwota z dokumentu; `undefined` = brak albo śmieć. Zaokrąglona do groszy. */
export function cleanAmount(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= AMOUNT_MAX ? Math.round(v * 100) / 100 : undefined;
}

/** Sposoby w stałej kolejności, bez powtórzeń i nieznanych; `undefined` = nie zapisano. */
export function cleanModes(raw: unknown): BillingMode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return BILLING_MODES.filter((m) => raw.includes(m));
}

/**
 * Kwota wpisana w polu: „1 250,50” → 1250.5; pusty tekst → `null` (usuń); zły tekst → `undefined`.
 * Spacje (`\s` obejmuje też twarde z formatowania) i „zł” są pomijane.
 */
export function parseAmount(raw: string): number | null | undefined {
  const t = raw.replace(/\s/g, "").replace(/zł$/i, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return undefined;
  return cleanAmount(Number(t));
}

/** Stawka za punkt danego typu: własna typu albo domyślna; `undefined` = bez stawki. */
export const pointRateFor = (b: Pick<SiteBilling, "pointRate" | "typeRates">, typeId: string): number | undefined => b.typeRates[typeId] ?? b.pointRate;

/** „1 250,50 zł” / „8 000 zł”. */
export const money = (n: number) => `${n.toLocaleString("pl-PL", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} zł`;

/** Kwota w polu do edycji: „1250,5”. */
export const amountInput = (n: number | undefined) => (n === undefined ? "" : String(n).replace(".", ","));

/** Suma ryczałtów za etapy. */
export const stagesTotal = (b: Pick<SiteBilling, "stageAmounts">) => Object.values(b.stageAmounts).reduce((s, n) => s + n, 0);

/** Jedna linia w nagłówku panelu: „Godziny · Od punktu 150 zł · Ryczałt 8 000 zł”; `rate` = stawka godzinowa karty. */
export function billingSummary(b: SiteBilling, rate?: number): string {
  if (b.modes.length === 0) return "nie wybrano";
  return b.modes.map((m) => {
    if (m === "hours") return rate ? `${MODE_LABEL.hours} ${money(rate)}/h` : MODE_LABEL.hours;
    if (m === "points") return b.pointRate !== undefined ? `${MODE_LABEL.points} ${money(b.pointRate)}` : MODE_LABEL.points;
    const total = (b.lump ?? 0) + stagesTotal(b);
    return total > 0 ? `${MODE_LABEL.lump} ${money(Math.round(total * 100) / 100)}` : MODE_LABEL.lump;
  }).join(" · ");
}
