/**
 * Dodatek nocny (art. 151⁸ KP): 20% stawki godzinowej minimalnego wynagrodzenia za pracę
 * za każdą godzinę pracy w porze nocnej. Kwota liczona z minimalnej stawki roku, chyba że
 * użytkownik wpisał własną (`ShiftData.nightRate`, zł/h).
 */

/** Minimalna stawka godzinowa wg roku (zł). Aktualizować przy zmianie minimalnego wynagrodzenia. */
export const MIN_HOURLY_WAGE: Readonly<Record<number, number>> = {
  // 2026: rozporządzenie Rady Ministrów z 11.09.2025 r. (Dz.U. 2025 poz. 1242) — 31,40 zł brutto.
  // 2027 jeszcze nieustalone (projekt przyjęty 9.06.2026, rozporządzenie do 15.09); dopisać po publikacji.
  2026: 31.4,
};

export const NIGHT_SURCHARGE_SHARE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Minimalna stawka roku; dla roku spoza tabeli — ostatnio znany rok (zaniżony, ale nie zero). */
export function minimumHourlyWage(year: number): number {
  if (MIN_HOURLY_WAGE[year] !== undefined) return MIN_HOURLY_WAGE[year];
  const known = Object.keys(MIN_HOURLY_WAGE).map(Number).sort((a, b) => b - a);
  return known.length ? MIN_HOURLY_WAGE[known[0]] : 0;
}

/** Stawka dodatku nocnego (zł/h): ręczna, gdy podana (> 0), inaczej 20% minimalnej stawki roku. */
export function nightRateFor(year: number, override: number): number {
  if (override > 0) return override;
  return round2(minimumHourlyWage(year) * NIGHT_SURCHARGE_SHARE);
}

/** Kwota dodatku za `nightMinutes` minut pracy nocnej. */
export function nightAllowance(nightMinutes: number, rate: number): number {
  return round2((nightMinutes / 60) * rate);
}
