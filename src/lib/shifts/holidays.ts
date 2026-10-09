/**
 * Polskie święta ustawowo wolne od pracy i wymiar czasu pracy (art. 130 KP).
 * Wszystko na kluczach dnia „RRRR-MM-DD” w czasie lokalnym.
 */

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Niedziela Wielkanocna — algorytm Meeusa/Jonesa/Butchera (kalendarz gregoriański). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const cache = new Map<number, Map<string, string>>();

/** Święta roku: klucz dnia → nazwa. */
export function polishHolidays(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const easter = easterSunday(year);
  const fromEaster = (days: number) => {
    const d = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + days);
    return key(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  const list: [string, string][] = [
    [key(year, 1, 1), "Nowy Rok"],
    [fromEaster(0), "Wielkanoc"],
    [fromEaster(1), "Poniedziałek Wielkanocny"],
    [key(year, 5, 1), "Święto Pracy"],
    [key(year, 5, 3), "Święto Konstytucji 3 Maja"],
    [fromEaster(49), "Zielone Świątki"],
    [fromEaster(60), "Boże Ciało"],
    [key(year, 8, 15), "Wniebowzięcie NMP"],
    [key(year, 11, 1), "Wszystkich Świętych"],
    [key(year, 11, 11), "Święto Niepodległości"],
    [key(year, 12, 25), "Boże Narodzenie"],
    [key(year, 12, 26), "Drugi dzień Bożego Narodzenia"],
  ];
  if (year >= 2011) list.push([key(year, 1, 6), "Trzech Króli"]);
  // Wigilia jest dniem wolnym od 2025 r.
  if (year >= 2025) list.push([key(year, 12, 24), "Wigilia"]);
  const map = new Map(list);
  cache.set(year, map);
  return map;
}

export function holidayName(dayKey: string): string | undefined {
  return polishHolidays(Number(dayKey.slice(0, 4))).get(dayKey);
}

/**
 * Czy dzień wlicza się do wymiaru czasu pracy: poniedziałek–piątek i nie święto.
 * Tylko nieobecność w taki dzień obniża normę (art. 130 § 3 KP).
 */
export function isNormDay(dayKey: string): boolean {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow >= 1 && dow <= 5 && !polishHolidays(y).has(dayKey);
}

/**
 * Wymiar czasu pracy w miesiącu (minuty) dla pełnego etatu, art. 130 KP:
 * 8 h × dni od poniedziałku do piątku, minus 8 h za każde święto
 * przypadające w innym dniu niż niedziela (także w sobotę).
 * `month` od 0 jak w `Date`.
 */
export function workNormMinutes(year: number, month: number, dailyHours = 8): number {
  const holidays = polishHolidays(year);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let days = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow >= 1 && dow <= 5) days += 1;
    if (dow !== 0 && holidays.has(key(year, month + 1, d))) days -= 1;
  }
  return Math.max(0, days) * dailyHours * 60;
}
