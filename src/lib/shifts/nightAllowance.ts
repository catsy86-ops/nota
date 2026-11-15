/**
 * Dodatek nocny (art. 151⁸ § 1 KP): 20% stawki godzinowej wynikającej z minimalnego wynagrodzenia
 * za pracę, za każdą godzinę pracy w porze nocnej. Ta stawka to minimalne wynagrodzenie miesięczne
 * podzielone przez liczbę godzin do przepracowania w danym miesiącu (wymiar z art. 130 KP), więc
 * zmienia się co miesiąc — to nie jest minimalna stawka godzinowa dla zleceń. Użytkownik może
 * wpisać własną (`ShiftData.nightRate`, zł/h).
 */
import { workNormMinutes } from "./holidays";

/** Minimalne wynagrodzenie miesięczne wg roku (zł brutto). Aktualizować po rozporządzeniu. */
export const MIN_MONTHLY_WAGE: Readonly<Record<number, number>> = {
  // 2026: rozporządzenie Rady Ministrów z 11.09.2025 r. (Dz.U. 2025 poz. 1242) — 4806 zł brutto.
  // 2027 jeszcze nieustalone (projekt przyjęty 9.06.2026, rozporządzenie do 15.09); dopisać po publikacji.
  2026: 4806,
};

export const NIGHT_SURCHARGE_SHARE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Minimalne wynagrodzenie roku; dla roku spoza tabeli — ostatnio znany rok (zaniżone, ale nie zero). */
export function minimumMonthlyWage(year: number): number {
  if (MIN_MONTHLY_WAGE[year] !== undefined) return MIN_MONTHLY_WAGE[year];
  const known = Object.keys(MIN_MONTHLY_WAGE).map(Number).sort((a, b) => b - a);
  return known.length ? MIN_MONTHLY_WAGE[known[0]] : 0;
}

/**
 * Stawka dodatku nocnego (zł/h) w miesiącu (`month` od 0): ręczna, gdy podana (> 0), inaczej
 * 20% z (minimalne wynagrodzenie ÷ godziny wymiaru miesiąca dla pełnego etatu).
 */
export function nightRateFor(year: number, month: number, override: number): number {
  if (override > 0) return override;
  const hours = workNormMinutes(year, month) / 60;
  return hours > 0 ? round2((minimumMonthlyWage(year) / hours) * NIGHT_SURCHARGE_SHARE) : 0;
}

/** Kwota dodatku za `nightMinutes` minut pracy nocnej. */
export function nightAllowance(nightMinutes: number, rate: number): number {
  return round2((nightMinutes / 60) * rate);
}
