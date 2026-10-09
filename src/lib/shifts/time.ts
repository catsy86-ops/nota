import type { DayEntry, ShiftType } from "./model";

/** Czas trzymamy w minutach od północy dnia, w którym zmiana się zaczyna. */
const DAY_MIN = 24 * 60;
/** Pora nocna — przyjmujemy 22:00–6:00 (Kodeks pracy pozwala wybrać 8 h między 21 a 7). */
const NIGHT_START = 22 * 60;
const NIGHT_END = 6 * 60;

/** „HH:MM” → minuty od północy; śmieci → NaN. */
export function parseHm(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

/** Zakres zmiany; koniec ≤ start = zmiana przez północ. */
export function shiftSpan(type: Pick<ShiftType, "start" | "end">): { from: number; to: number } | null {
  const from = parseHm(type.start);
  let to = parseHm(type.end);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  if (to <= from) to += DAY_MIN;
  return { from, to };
}

/** Planowany czas zmiany w minutach, bez przerwy. */
export function shiftMinutes(type: Pick<ShiftType, "start" | "end" | "breakMin">): number {
  const span = shiftSpan(type);
  if (!span) return 0;
  return Math.max(0, span.to - span.from - Math.max(0, type.breakMin || 0));
}

/** Faktyczny czas dnia: plan + odchylenie z wpisu, nigdy poniżej zera. */
export function entryMinutes(type: Pick<ShiftType, "start" | "end" | "breakMin">, entry?: Pick<DayEntry, "extraMin">): number {
  return Math.max(0, shiftMinutes(type) + (entry?.extraMin ?? 0));
}

/**
 * Różnica między czasem rzeczywistym a ściennym zmiany zaczynającej się
 * w `dayKey` (czas lokalny): +60 w noc zmiany czasu na zimowy (22–6 trwa 9 h),
 * −60 przy zmianie na letni (7 h), poza tym 0.
 */
export function dstShiftMinutes(type: Pick<ShiftType, "start" | "end">, dayKey: string, extraMin = 0): number {
  const span = shiftSpan(type);
  if (!span) return 0;
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, span.from).getTime();
  const end = new Date(y, m - 1, d, 0, span.to + extraMin).getTime();
  return Math.round((end - start) / 60_000) - (span.to + extraMin - span.from);
}

type BreakFields = Pick<ShiftType, "start" | "end" | "breakMin" | "breakAt">;

/**
 * Początek przerwy w minutach od początku zmiany; `null`, gdy przerwa nie ma
 * godziny albo nie mieści się w zmianie — wtedy liczymy ją jak dotąd, na końcu.
 */
export function breakOffset(type: BreakFields): number | null {
  if (!type.breakAt || !(type.breakMin > 0)) return null;
  const span = shiftSpan(type);
  let at = parseHm(type.breakAt);
  if (!span || Number.isNaN(at)) return null;
  if (at < span.from) at += DAY_MIN;
  const off = at - span.from;
  return off + type.breakMin <= span.to - span.from ? off : null;
}

/**
 * Odcinek [a, z) minut pracy od początku zmiany → odcinki czasu ściennego
 * (minuty od początku zmiany). Przerwa w środku rozcina odcinek i przesuwa
 * resztę o swoją długość.
 */
export function workToWall(type: BreakFields, a: number, z: number): [number, number][] {
  const b = breakOffset(type);
  if (b === null || z <= b) return [[a, z]];
  if (a >= b) return [[a + type.breakMin, z + type.breakMin]];
  return [[a, b], [b + type.breakMin, z + type.breakMin]];
}

/** Minuty pracy od początku zmiany do chwili `wall` (minuty ścienne od początku zmiany). */
export function wallToWork(type: BreakFields, wall: number): number {
  const b = breakOffset(type);
  if (b === null || wall <= b) return wall;
  return Math.max(b, wall - type.breakMin);
}

/** Jak `entryMinutes`, ale z rzeczywistą długością doby w dniu zmiany czasu. */
export function entryMinutesOn(type: Pick<ShiftType, "start" | "end" | "breakMin">, entry: Pick<DayEntry, "extraMin"> | undefined, dayKey: string): number {
  return Math.max(0, entryMinutes(type, entry) + dstShiftMinutes(type, dayKey, entry?.extraMin ?? 0));
}

/** Minuty odcinka [from, to) (od północy dnia startu, najwyżej dwie doby) w porze nocnej. */
function nightOverlap(from: number, to: number): number {
  let total = 0;
  for (let k = -1; k <= 1; k++) {
    const a = NIGHT_START + k * DAY_MIN;
    const b = NIGHT_END + (k + 1) * DAY_MIN;
    total += Math.max(0, Math.min(to, b) - Math.max(from, a));
  }
  return total;
}

/**
 * Minuty zmiany w porze nocnej, bez przerwy, jeśli ma godzinę (`breakAt`).
 * Przerwy bez godziny nie odejmujemy — nie wiemy, kiedy była.
 */
export function nightMinutes(type: Pick<ShiftType, "start" | "end"> & Partial<Pick<ShiftType, "breakMin" | "breakAt">>): number {
  const span = shiftSpan(type);
  if (!span) return 0;
  const b = breakOffset({ breakMin: 0, ...type });
  const inBreak = b === null ? 0 : nightOverlap(span.from + b, span.from + b + (type.breakMin ?? 0));
  return nightOverlap(span.from, span.to) - inBreak;
}

/** 510 → „8 h 30 min”, 480 → „8 h”, 45 → „45 min”, −30 → „−30 min”. */
export function formatDuration(min: number): string {
  const sign = min < 0 ? "−" : "";
  const abs = Math.abs(Math.round(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} min`;
  return `${sign}${m === 0 ? `${h} h` : `${h} h ${m} min`}`;
}

/** 510 → „8,5” — krótko, do komórki kalendarza i dużej liczby. */
export function formatHoursShort(min: number): string {
  return String(Math.round((min / 60) * 100) / 100).replace(".", ",");
}

export function formatMoney(zl: number): string {
  return zl.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}
