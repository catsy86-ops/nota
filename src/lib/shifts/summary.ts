import { isAbsence, type DayEntry, type ShiftData, type ShiftType } from "./model";
import { entryMinutes, nightMinutes, shiftSpan } from "./time";
import { workNormMinutes } from "./holidays";

export interface ShiftTypeTotal {
  type: ShiftType;
  count: number;
  minutes: number;
}

export interface MonthSummary {
  daysWorked: number;
  /** Przepracowane minuty (tylko zmiany `work`, z odchyleniami). */
  minutes: number;
  nightMinutes: number;
  /** Wymiar czasu pracy po odjęciu nieobecności. */
  normMinutes: number;
  /** Ponad normę; 0 gdy poniżej. */
  overtimeMinutes: number;
  absenceDays: number;
  /** Zarobek brutto w zł (z dopłatą za nadgodziny); 0 gdy brak stawek. */
  earnings: number;
  byType: ShiftTypeTotal[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Podsumowanie miesiąca (`month` od 0). Dzień należy do miesiąca, w którym
 * zmiana się zaczęła. Nadgodziny liczone w okresie rozliczeniowym = miesiąc;
 * dopłata za nie = stawka domyślna × (mnożnik − 1), bo podstawę każda
 * godzina dostała już w swojej stawce.
 */
export function monthSummary(data: ShiftData, year: number, month: number): MonthSummary {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const totals = new Map<string, ShiftTypeTotal>();
  let minutes = 0;
  let night = 0;
  let base = 0;
  let daysWorked = 0;
  let absenceDays = 0;
  let absenceMinutes = 0;

  for (const [key, entry] of Object.entries(data.days)) {
    if (!key.startsWith(prefix)) continue;
    const type = typesById.get(entry.type);
    if (!type) continue;
    const m = entryMinutes(type, entry);
    const t = totals.get(type.id) ?? { type, count: 0, minutes: 0 };
    t.count += 1;
    t.minutes += m;
    totals.set(type.id, t);
    if (isAbsence(type)) {
      absenceDays += 1;
      absenceMinutes += m;
      continue;
    }
    daysWorked += 1;
    minutes += m;
    night += nightMinutes(type);
    base += (m / 60) * (type.rate ?? data.hourlyRate);
  }

  const normMinutes = Math.max(0, workNormMinutes(year, month) - absenceMinutes);
  const overtimeMinutes = Math.max(0, minutes - normMinutes);
  const premium = (overtimeMinutes / 60) * data.hourlyRate * (data.overtimeMultiplier - 1);

  return {
    daysWorked,
    minutes,
    nightMinutes: night,
    normMinutes,
    overtimeMinutes,
    absenceDays,
    earnings: round2(base + premium),
    byType: data.types.map((t) => totals.get(t.id)).filter((t): t is ShiftTypeTotal => !!t),
  };
}

export interface ShiftOccurrence {
  dayKey: string;
  type: ShiftType;
  entry: DayEntry;
  start: Date;
  end: Date;
}

function occurrence(data: ShiftData, dayKey: string, typesById: Map<string, ShiftType>): ShiftOccurrence | null {
  const entry = data.days[dayKey];
  const type = entry && typesById.get(entry.type);
  if (!type || isAbsence(type)) return null;
  const span = shiftSpan(type);
  if (!span) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, span.from);
  const end = new Date(y, m - 1, d, 0, span.to + (entry.extraMin ?? 0));
  return { dayKey, type, entry, start, end };
}

/**
 * Zmiana trwająca teraz (także nocna z wczoraj) i najbliższa następna,
 * szukana do `horizonDays` dni naprzód.
 */
export function currentAndNextShift(data: ShiftData, now: Date, horizonDays = 60): { current: ShiftOccurrence | null; next: ShiftOccurrence | null } {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  let current: ShiftOccurrence | null = null;
  let next: ShiftOccurrence | null = null;
  for (let i = -1; i <= horizonDays && !next; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const occ = occurrence(data, k, typesById);
    if (!occ) continue;
    if (occ.start <= now && now < occ.end) current = occ;
    else if (occ.start > now) next = occ;
  }
  return { current, next };
}
