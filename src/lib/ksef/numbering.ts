/**
 * Numeracja faktur bez kolizji między telefonami (ADR-6): każde urządzenie ma własną serię (litera lub krótki kod),
 * a numer to `FV/{seria}/{rok}/{kolejny}`. Licznik wynika z faktur już zapisanych w dokumencie (największy numer tej
 * serii w danym roku + 1), więc przeżywa przywrócenie kopii i nie wymaga osobnego stanu, który mógłby się rozjechać.
 * Dwa urządzenia z tą samą serią dałyby duplikat — `findDuplicateNumbers` go wykrywa.
 */

export const SERIES_MAX = 6;

/** Seria: litery i cyfry bez polskich znaków, wielkie, do 6 znaków; pusta → „A”. */
export const cleanSeries = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, SERIES_MAX) || "A";

/** Przedrostek numeru: `FV` faktura, `FK` korekta (osobny licznik, ta sama seria urządzenia). */
export type NumberKind = "FV" | "FK";

export function formatInvoiceNumber(series: string, year: number, seq: number, kind: NumberKind = "FV"): string {
  return `${kind}/${cleanSeries(series)}/${year}/${String(seq).padStart(3, "0")}`;
}

const NUMBER_RE = /^(FV|FK)\/([A-Z0-9]{1,6})\/(\d{4})\/(\d+)$/;

export function parseInvoiceNumber(n: string): { kind: NumberKind; series: string; year: number; seq: number } | null {
  const m = NUMBER_RE.exec(n);
  return m ? { kind: m[1] as NumberKind, series: m[2], year: Number(m[3]), seq: Number(m[4]) } : null;
}

/** Następny numer serii w roku, na podstawie numerów istniejących faktur. */
export function nextInvoiceNumber(series: string, year: number, existing: readonly string[], kind: NumberKind = "FV"): string {
  const s = cleanSeries(series);
  let max = 0;
  for (const n of existing) {
    const p = parseInvoiceNumber(n);
    if (p && p.kind === kind && p.series === s && p.year === year && p.seq > max) max = p.seq;
  }
  return formatInvoiceNumber(s, year, max + 1, kind);
}

/** Numery występujące więcej niż raz (np. dwa telefony z tą samą serią). */
export function findDuplicateNumbers(numbers: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const n of numbers) (seen.has(n) ? dup : seen).add(n);
  return [...dup];
}

/** Luki w ciągu numerów serii w roku (np. 1, 2, 4 → [3]); do ostrzeżenia w rejestrze. */
export function findGaps(series: string, year: number, existing: readonly string[], kind: NumberKind = "FV"): number[] {
  const s = cleanSeries(series);
  const seqs = new Set<number>();
  for (const n of existing) {
    const p = parseInvoiceNumber(n);
    if (p && p.kind === kind && p.series === s && p.year === year) seqs.add(p.seq);
  }
  const max = Math.max(0, ...seqs);
  const gaps: number[] = [];
  for (let i = 1; i < max; i++) if (!seqs.has(i)) gaps.push(i);
  return gaps;
}
