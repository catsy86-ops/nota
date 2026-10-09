import { isAbsence, type DayEntry, type ShiftData, type ShiftType } from "./model";
import { dstShiftMinutes, entryMinutesOn, nightMinutes, shiftMinutes, shiftSpan } from "./time";
import { isNormDay, workNormMinutes } from "./holidays";

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
  /** Wszystkie nadgodziny: dobowe + ponad normę okresu (już bez dobowych). */
  overtimeMinutes: number;
  /** Z tego nadgodziny dobowe (ponad limit w dobie pracowniczej). */
  dailyOvertimeMinutes: number;
  absenceDays: number;
  /** Zarobek brutto w zł (z dopłatą za nadgodziny); 0 gdy brak stawek. */
  earnings: number;
  byType: ShiftTypeTotal[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const DAY_MS = 24 * 60 * 60_000;

interface WorkSpan {
  key: string;
  start: number;
  /** Minuty pracy (z odchyleniem i zmianą czasu); przerwa skraca koniec. */
  len: number;
  /** Dobowy limit tej zmiany w minutach. */
  limit: number;
}

/**
 * Nadgodziny dobowe (art. 151 § 1 pkt 1 KP) per dzień startu zmiany.
 * Doba pracownicza to 24 h od początku zmiany (art. 128 § 3), więc np.
 * popołudniówka 14–22 i ranna 6–14 następnego dnia to 8 h nadgodzin —
 * mimo że każda zmiana ma tylko 8 h. Minuty uznane za nadgodziny w jednej
 * dobie nie liczą się już w następnej.
 */
export function dailyOvertimeByDay(data: ShiftData): Map<string, number> {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const spans: WorkSpan[] = [];
  for (const [key, entry] of Object.entries(data.days)) {
    const type = typesById.get(entry.type);
    if (!type || isAbsence(type)) continue;
    const span = shiftSpan(type);
    if (!span) continue;
    const [y, m, d] = key.split("-").map(Number);
    const planned = shiftMinutes(type);
    // Równoważny: norma dobowa to godziny z grafiku, najwyżej 12 h; podstawowy: 8 h.
    const limit = data.workSystem === "equivalent" ? Math.min(12 * 60, Math.max(8 * 60, planned)) : 8 * 60;
    spans.push({ key, start: new Date(y, m - 1, d, 0, span.from).getTime(), len: entryMinutesOn(type, entry, key), limit });
  }
  spans.sort((a, b) => a.start - b.start);

  // Minuty od początku zmiany, które już poszły jako nadgodziny poprzedniej doby.
  const headOt = new Array<number>(spans.length).fill(0);
  const result = new Map<string, number>();
  for (let i = 0; i < spans.length; i++) {
    const own = Math.max(0, spans[i].len - headOt[i]);
    const dobaEnd = spans[i].start + DAY_MS;
    const later: { j: number; counted: number }[] = [];
    for (let j = i + 1; j < spans.length && spans[j].start < dobaEnd; j++) {
      const inDoba = Math.min(spans[j].len, (dobaEnd - spans[j].start) / 60_000);
      later.push({ j, counted: Math.max(0, inDoba - headOt[j]) });
    }
    let over = own + later.reduce((sum, l) => sum + l.counted, 0) - spans[i].limit;
    if (over <= 0) continue;
    // Nadwyżka własnej zmiany ponad limit, potem to, co następne zmiany wniosły do tej doby.
    const ownOver = Math.min(over, Math.max(0, own - spans[i].limit));
    if (ownOver > 0) result.set(spans[i].key, (result.get(spans[i].key) ?? 0) + ownOver);
    over -= ownOver;
    for (const { j, counted } of later) {
      if (over <= 0) break;
      const take = Math.min(over, counted);
      headOt[j] += take;
      result.set(spans[j].key, (result.get(spans[j].key) ?? 0) + take);
      over -= take;
    }
  }
  return result;
}

/**
 * Podsumowanie miesiąca (`month` od 0). Dzień należy do miesiąca, w którym
 * zmiana się zaczęła. Nadgodziny = dobowe (`dailyOvertimeByDay`) plus
 * przekroczenie normy miesiąca przez pozostałe godziny (art. 151 § 1 KP,
 * okres rozliczeniowy = miesiąc);
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
    const m = entryMinutesOn(type, entry, key);
    const t = totals.get(type.id) ?? { type, count: 0, minutes: 0 };
    t.count += 1;
    t.minutes += m;
    totals.set(type.id, t);
    if (isAbsence(type)) {
      absenceDays += 1;
      // L4 czy urlop w sobotę, niedzielę albo święto nie zmniejsza normy — tego dnia jej nie ma.
      if (isNormDay(key)) absenceMinutes += m;
      continue;
    }
    daysWorked += 1;
    minutes += m;
    const nightPlan = nightMinutes(type);
    // Zmiana czasu wypada o 2–3 w nocy, więc dodatkowa/brakująca godzina jest godziną nocną.
    night += nightPlan > 0 ? Math.max(0, nightPlan + dstShiftMinutes(type, key)) : 0;
    base += (m / 60) * (type.rate ?? data.hourlyRate);
  }

  const normMinutes = Math.max(0, workNormMinutes(year, month) - absenceMinutes);
  let dailyOvertimeMinutes = 0;
  for (const [key, ot] of dailyOvertimeByDay(data)) if (key.startsWith(prefix)) dailyOvertimeMinutes += ot;
  // Godziny już uznane za nadgodziny dobowe nie liczą się drugi raz do normy.
  const overtimeMinutes = dailyOvertimeMinutes + Math.max(0, minutes - dailyOvertimeMinutes - normMinutes);
  const premium = (overtimeMinutes / 60) * data.hourlyRate * (data.overtimeMultiplier - 1);

  return {
    daysWorked,
    minutes,
    nightMinutes: night,
    normMinutes,
    overtimeMinutes,
    dailyOvertimeMinutes,
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
