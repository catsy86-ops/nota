/**
 * Dodatek nocny (art. 151⁸ § 1 KP): 20% stawki godzinowej wynikającej z minimalnego wynagrodzenia
 * za pracę, za każdą godzinę pracy w porze nocnej. Sposób liczenia podaje § 4b rozporządzenia
 * MPiPS z 29.05.1996 r. (Dz.U. nr 62 poz. 289 ze zm.): minimalne wynagrodzenie dzieli się przez
 * liczbę godzin pracy przypadających do przepracowania w danym miesiącu (wymiar z art. 130 KP),
 * więc stawka zmienia się co miesiąc — to nie jest minimalna stawka godzinowa dla zleceń.
 * Użytkownik może wpisać własną (`ShiftData.nightRate`, zł/h).
 *
 * Niepełny etat nie zmienia stawki i dlatego funkcja nie bierze wymiaru etatu: minimalne
 * wynagrodzenie maleje proporcjonalnie do etatu (art. 8 ust. 1 ustawy z 10.10.2002 r.
 * o minimalnym wynagrodzeniu) i tak samo maleje liczba godzin do przepracowania, więc iloraz
 * jest ten sam co dla pełnego etatu. Dzielnikiem jest wymiar nominalny miesiąca, a nie godziny
 * z indywidualnego grafiku (w systemie równoważnym grafik miesiąca bywa dłuższy albo krótszy).
 */
import { workNormMinutes } from "./holidays";

/** Minimalne wynagrodzenie miesięczne wg roku (zł brutto). Aktualizować po rozporządzeniu. */
export const MIN_MONTHLY_WAGE: Readonly<Record<number, number>> = {
  // 2026: rozporządzenie Rady Ministrów z 11.09.2025 r. (Dz.U. 2025 poz. 1242) — 4806 zł brutto.
  2026: 4806,
  // 2027: rozporządzenie Rady Ministrów z 14.09.2026 r. (Dz.U. z 15.09.2026) — 4950 zł brutto.
  2027: 4950,
};

export const NIGHT_SURCHARGE_SHARE = 0.2;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Minimalne wynagrodzenie roku. Dla roku spoza tabeli — najbliższy znany rok wstecz (kwota
 * zaniżona, ale nie zero), a dla roku sprzed tabeli — najwcześniejszy znany.
 */
export function minimumMonthlyWage(year: number): number {
  if (MIN_MONTHLY_WAGE[year] !== undefined) return MIN_MONTHLY_WAGE[year];
  const known = Object.keys(MIN_MONTHLY_WAGE).map(Number).sort((x, y) => x - y);
  if (!known.length) return 0;
  const earlier = known.filter((y) => y < year);
  return MIN_MONTHLY_WAGE[earlier.length ? earlier[earlier.length - 1] : known[0]];
}

/**
 * Stawka dodatku nocnego (zł/h) w miesiącu (`month` od 0): ręczna, gdy podana (> 0), inaczej
 * 20% z (minimalne wynagrodzenie ÷ godziny wymiaru miesiąca dla pełnego etatu). Ta sama przy
 * niepełnym etacie — patrz nagłówek pliku.
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
