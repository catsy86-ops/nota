import { dayType, isAbsence, type DayEntry, type SettlementMonths, type ShiftBonus, type ShiftData, type ShiftType } from "./model";
import { dstShiftMinutes, entryMinutesOn, isNightHour, nightMinutes, shiftMinutes, shiftSpan, wallToWork, workToWall } from "./time";
import { holidayName, isNormDay, workNormMinutes } from "./holidays";

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
  /** Wymiar czasu pracy (wg etatu) po odjęciu nieobecności. */
  normMinutes: number;
  /**
   * Godziny ponadwymiarowe (niepełny etat): ponad normę etatu, ale w normie
   * pełnego etatu — bez dodatku za nadgodziny. Jak nadgodziny ponad normę,
   * wykazane w ostatnim miesiącu okresu.
   */
  extraTimeMinutes: number;
  /** Wszystkie nadgodziny: dobowe + ponad normę okresu (już bez dobowych). */
  overtimeMinutes: number;
  /** Z tego nadgodziny dobowe (ponad limit w dobie pracowniczej). */
  dailyOvertimeMinutes: number;
  /** Z tego z dodatkiem 100% (noc, niedziela, święto, ponad normę okresu) — reszta ma 50%. */
  overtime100Minutes: number;
  absenceDays: number;
  /** Zarobek brutto w zł (z dodatkami za nadgodziny i premiami); 0 gdy brak stawek. */
  earnings: number;
  /** Premie tego miesiąca (już w `earnings`). */
  bonuses: ShiftBonus[];
  /** Suma premii tego miesiąca w zł. */
  bonusTotal: number;
  byType: ShiftTypeTotal[];
  /** Zmiany tego miesiąca zaczynające się po odpoczynku krótszym niż 11 h. */
  shortRests: ShortRest[];
  /** Okres rozliczeniowy dłuższy niż miesiąc; `null` przy miesięcznym. */
  period: PeriodSummary | null;
}

export interface PeriodSummary {
  year: number;
  startMonth: number;
  months: SettlementMonths;
  /** Wymiar całego okresu po odjęciu nieobecności. */
  normMinutes: number;
  /** Przepracowane od początku okresu do tego miesiąca włącznie. */
  minutes: number;
  /** Ostatni miesiąc okresu — wtedy liczy się przekroczenie normy. */
  isLast: boolean;
}

export interface ShortRest {
  /** Dzień zmiany, przed którą zabrakło odpoczynku. */
  dayKey: string;
  restMinutes: number;
}

/** Odpoczynek dobowy — art. 132 § 1 KP. */
export const MIN_REST_MINUTES = 11 * 60;

const round2 = (n: number) => Math.round(n * 100) / 100;

const DAY_MS = 24 * 60 * 60_000;

interface WorkSpan {
  key: string;
  start: number;
  /** Minuty pracy (z odchyleniem i zmianą czasu); przerwa skraca koniec. */
  len: number;
  /** Dobowy limit tej zmiany w minutach. */
  limit: number;
  /** Godziny zmiany tego dnia — do umieszczenia przerwy w czasie. */
  type: ShiftType;
}

/** Odcinek nadgodzin dobowych: zmiana, do której należy, i czas ścienny (ms). */
export interface OvertimeSpan {
  key: string;
  from: number;
  to: number;
  /** Stawka godzinowa zmiany (zł), od której liczy się dodatek. */
  rate: number;
}

/**
 * Nadgodziny dobowe (art. 151 § 1 pkt 1 KP) jako odcinki czasu.
 * Doba pracownicza to 24 h od początku zmiany (art. 128 § 3), więc np.
 * popołudniówka 14–22 i ranna 6–14 następnego dnia to 8 h nadgodzin —
 * mimo że każda zmiana ma tylko 8 h. Minuty uznane za nadgodziny w jednej
 * dobie nie liczą się już w następnej. Nadwyżka własnej zmiany to jej
 * koniec, a wniesiona do cudzej doby — początek następnej zmiany. Przerwa
 * z godziną (`breakAt`) rozcina zmianę; bez godziny skraca jej koniec.
 */
export function dailyOvertimeSpans(data: ShiftData): OvertimeSpan[] {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const spans: (WorkSpan & { rate: number })[] = [];
  for (const [key, entry] of Object.entries(data.days)) {
    const base = typesById.get(entry.type);
    if (!base || isAbsence(base)) continue;
    const type = dayType(base, entry);
    const span = shiftSpan(type);
    if (!span) continue;
    const [y, m, d] = key.split("-").map(Number);
    const planned = shiftMinutes(type);
    // Równoważny: norma dobowa to godziny z grafiku, najwyżej 12 h; podstawowy: 8 h.
    const limit = data.workSystem === "equivalent" ? Math.min(12 * 60, Math.max(8 * 60, planned)) : 8 * 60;
    spans.push({ key, start: new Date(y, m - 1, d, 0, span.from).getTime(), len: entryMinutesOn(type, entry, key), limit, type, rate: type.rate ?? data.hourlyRate });
  }
  spans.sort((a, b) => a.start - b.start);

  // Minuty od początku zmiany, które już poszły jako nadgodziny poprzedniej doby.
  const headOt = new Array<number>(spans.length).fill(0);
  const result: OvertimeSpan[] = [];
  const push = (i: number, fromMin: number, minutes: number) => {
    const s = spans[i];
    for (const [a, z] of workToWall(s.type, fromMin, fromMin + minutes)) {
      result.push({ key: s.key, from: s.start + a * 60_000, to: s.start + z * 60_000, rate: s.rate });
    }
  };
  for (let i = 0; i < spans.length; i++) {
    const own = Math.max(0, spans[i].len - headOt[i]);
    const dobaEnd = spans[i].start + DAY_MS;
    const later: { j: number; counted: number }[] = [];
    for (let j = i + 1; j < spans.length && spans[j].start < dobaEnd; j++) {
      const inDoba = Math.min(spans[j].len, wallToWork(spans[j].type, (dobaEnd - spans[j].start) / 60_000));
      later.push({ j, counted: Math.max(0, inDoba - headOt[j]) });
    }
    let over = own + later.reduce((sum, l) => sum + l.counted, 0) - spans[i].limit;
    if (over <= 0) continue;
    // Nadwyżka własnej zmiany ponad limit, potem to, co następne zmiany wniosły do tej doby.
    const ownOver = Math.min(over, Math.max(0, own - spans[i].limit));
    if (ownOver > 0) push(i, spans[i].len - ownOver, ownOver);
    over -= ownOver;
    for (const { j, counted } of later) {
      if (over <= 0) break;
      const take = Math.min(over, counted);
      push(j, headOt[j], take);
      headOt[j] += take;
      over -= take;
    }
  }
  return result;
}

/** Nadgodziny dobowe w minutach per dzień startu zmiany. */
export function dailyOvertimeByDay(data: ShiftData): Map<string, number> {
  const result = new Map<string, number>();
  for (const s of dailyOvertimeSpans(data)) result.set(s.key, (result.get(s.key) ?? 0) + (s.to - s.from) / 60_000);
  return result;
}

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Co decyduje o dodatku 100% (art. 151¹ § 1 pkt 1 KP): pora nocna i dni wolne. */
export interface PremiumRules {
  /** Dni ze zmianą z grafiku — niedziela czy święto są wtedy dniem pracy. */
  scheduled: ReadonlySet<string>;
  /** Dni wolne udzielone w zamian za pracę w niedzielę lub święto. */
  inLieu: ReadonlySet<string>;
  /** Godzina, od której liczy się niedziela i święto (art. 151¹⁰ KP). */
  sundayFrom: number;
  /** Początek pory nocnej (art. 151⁷ KP). */
  nightFrom: number;
}

export function premiumRules(data: ShiftData): PremiumRules {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const scheduled = new Set<string>();
  const inLieu = new Set<string>();
  for (const [key, entry] of Object.entries(data.days)) {
    const type = typesById.get(entry.type);
    if (!type || isAbsence(type)) continue;
    if (entry.inLieu) inLieu.add(key);
    else if (!entry.offSchedule) scheduled.add(key);
  }
  return { scheduled, inLieu, sundayFrom: data.sundayFrom, nightFrom: data.nightFrom };
}

const DEFAULT_RULES: PremiumRules = { scheduled: new Set(), inLieu: new Set(), sundayFrom: 6, nightFrom: 22 };

/**
 * Minuty odcinka z dodatkiem 100% (art. 151¹ § 1 pkt 1 KP): w porze nocnej
 * (`nightFrom`, 8 h) zawsze; w niedzielę i w święto — gdy wg grafiku to dzień wolny,
 * czyli nie ma w nim zaplanowanej zmiany; w dzień wolny udzielony w zamian
 * za pracę w niedzielę lub święto. Doba takiego dnia biegnie od godziny
 * `sundayFrom` (art. 151¹⁰ KP: domyślnie 6:00 do 6:00 następnego dnia).
 */
export function premium100Minutes({ from, to }: Pick<OvertimeSpan, "from" | "to">, days: PremiumRules = DEFAULT_RULES): number {
  let total = 0;
  for (let t = from; t < to; t += 60_000) {
    const d = new Date(t);
    const h = d.getHours();
    if (isNightHour(h, days.nightFrom)) { total++; continue; }
    // Dzień, do którego należy ta minuta, gdy doba zaczyna się o `sundayFrom`.
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h - days.sundayFrom, d.getMinutes());
    const key = localKey(day);
    if (days.inLieu.has(key) || ((day.getDay() === 0 || holidayName(key)) && !days.scheduled.has(key))) total++;
  }
  return total;
}

/**
 * Zmiany, przed którymi od końca poprzedniej (z odchyleniem) minęło mniej
 * niż 11 h. Uproszczenie: art. 132 KP liczy odpoczynek w dobie pracowniczej,
 * ale przy jednej zmianie na dzień to ta sama przerwa między zmianami.
 */
export function shortRests(data: ShiftData): ShortRest[] {
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const spans: { key: string; start: number; end: number }[] = [];
  for (const [key, entry] of Object.entries(data.days)) {
    const base = typesById.get(entry.type);
    if (!base || isAbsence(base)) continue;
    const type = dayType(base, entry);
    const span = shiftSpan(type);
    if (!span) continue;
    const [y, m, d] = key.split("-").map(Number);
    spans.push({ key, start: new Date(y, m - 1, d, 0, span.from).getTime(), end: new Date(y, m - 1, d, 0, span.to + (entry.extraMin ?? 0)).getTime() });
  }
  spans.sort((a, b) => a.start - b.start);
  const out: ShortRest[] = [];
  for (let i = 1; i < spans.length; i++) {
    const rest = Math.round((spans[i].start - spans[i - 1].end) / 60_000);
    if (rest < MIN_REST_MINUTES) out.push({ dayKey: spans[i].key, restMinutes: Math.max(0, rest) });
  }
  return out;
}

interface MonthCore {
  minutes: number;
  night: number;
  base: number;
  daysWorked: number;
  absenceDays: number;
  normMinutes: number;
  /** Granica nadgodzin przy niepełnym etacie (pełny etat albo umowna) po odjęciu nieobecności. */
  overtimeNormMinutes: number;
  totals: Map<string, ShiftTypeTotal>;
  dailyOvertime: number;
  daily100: number;
  dailyPremium: number;
}

const monthPrefix = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}-`;

function monthCore(data: ShiftData, year: number, month: number, otSpans: OvertimeSpan[], days: PremiumRules): MonthCore {
  const prefix = monthPrefix(year, month);
  const typesById = new Map(data.types.map((t) => [t.id, t]));
  const c: MonthCore = { minutes: 0, night: 0, base: 0, daysWorked: 0, absenceDays: 0, normMinutes: 0, overtimeNormMinutes: 0, totals: new Map(), dailyOvertime: 0, daily100: 0, dailyPremium: 0 };
  let absenceMinutes = 0;

  for (const [key, entry] of Object.entries(data.days)) {
    if (!key.startsWith(prefix)) continue;
    const base = typesById.get(entry.type);
    if (!base) continue;
    const type = dayType(base, entry);
    const m = entryMinutesOn(type, entry, key);
    const t = c.totals.get(base.id) ?? { type: base, count: 0, minutes: 0 };
    t.count += 1;
    t.minutes += m;
    c.totals.set(base.id, t);
    if (isAbsence(type)) {
      c.absenceDays += 1;
      // L4 czy urlop w sobotę, niedzielę albo święto nie zmniejsza normy — tego dnia jej nie ma.
      if (isNormDay(key)) absenceMinutes += m;
      continue;
    }
    c.daysWorked += 1;
    c.minutes += m;
    const nightPlan = nightMinutes(type, data.nightFrom);
    // Zmiana czasu wypada o 2–3 w nocy, więc dodatkowa/brakująca godzina jest godziną nocną.
    c.night += nightPlan > 0 ? Math.max(0, nightPlan + dstShiftMinutes(type, key)) : 0;
    c.base += (m / 60) * (type.rate ?? data.hourlyRate);
  }

  // Niepełny etat: norma proporcjonalna (art. 130 KP), nieobecność zdejmuje swoje godziny z obu.
  const full = workNormMinutes(year, month);
  c.normMinutes = Math.max(0, Math.round(full * data.fte) - absenceMinutes);
  c.overtimeNormMinutes = Math.max(0, Math.round(full * Math.max(data.fte, data.overtimeFrom)) - absenceMinutes);
  for (const span of otSpans) {
    if (!span.key.startsWith(prefix)) continue;
    const all = (span.to - span.from) / 60_000;
    const full = premium100Minutes(span, days);
    c.dailyOvertime += all;
    c.daily100 += full;
    c.dailyPremium += (span.rate / 60) * (full + (all - full) * 0.5);
  }
  return c;
}

/**
 * Okres rozliczeniowy, w który wpada miesiąc (`month` od 0). Okresy idą po
 * sobie od miesiąca `start` — kwartał od lutego to luty–kwiecień, maj–lipiec,
 * sierpień–październik, listopad–styczeń; ostatni zaczyna się rok wcześniej.
 */
export function settlementPeriod(year: number, month: number, months: SettlementMonths, start = 0): { year: number; startMonth: number; months: SettlementMonths } {
  const abs = year * 12 + month;
  const first = abs - ((((month - start) % months) + months) % months);
  return { year: Math.floor(first / 12), startMonth: first % 12, months };
}

/**
 * Podsumowanie miesiąca (`month` od 0). Dzień należy do miesiąca, w którym
 * zmiana się zaczęła. Nadgodziny = dobowe (`dailyOvertimeSpans`) plus
 * przekroczenie normy okresu rozliczeniowego przez pozostałe godziny
 * (art. 151 § 1 KP) — to drugie wykazane w ostatnim miesiącu okresu, bo
 * dopiero wtedy wiadomo, czy norma została przekroczona. Dodatek
 * (art. 151¹ KP) do stawki, którą każda godzina dostała już w podstawie:
 * 100% w nocy, w niedzielę i święto wolne wg grafiku, w dzień wolny za
 * niedzielę lub święto oraz za przekroczenie normy okresu, 50% za pozostałe nadgodziny dobowe.
 */
export function monthSummary(data: ShiftData, year: number, month: number): MonthSummary {
  const otSpans = dailyOvertimeSpans(data);
  const days = premiumRules(data);
  const c = monthCore(data, year, month, otSpans, days);
  const p = settlementPeriod(year, month, data.settlementMonths, data.settlementStart);
  // Miesiąc liczony od początku okresu — okres może przechodzić przez Nowy Rok.
  const index = (year - p.year) * 12 + month - p.startMonth;
  const cores = Array.from({ length: p.months }, (_, i) => {
    const abs = p.year * 12 + p.startMonth + i;
    return i === index ? c : monthCore(data, Math.floor(abs / 12), abs % 12, otSpans, days);
  });
  const sum = (f: (m: MonthCore) => number, upTo: number = p.months) => cores.slice(0, upTo).reduce((acc, m) => acc + f(m), 0);
  const periodNorm = sum((m) => m.normMinutes);
  const isLast = index === p.months - 1;
  // Godziny już uznane za nadgodziny dobowe nie liczą się drugi raz do normy.
  const worked = sum((m) => m.minutes - m.dailyOvertime);
  // Przy niepełnym etacie nadgodziny zaczynają się ponad normę pełnego etatu albo ponad granicę
  // z umowy (art. 151 § 5 KP); między normą etatu a tą granicą są godziny ponadwymiarowe.
  const periodOvertime = isLast ? Math.max(0, worked - sum((m) => m.overtimeNormMinutes)) : 0;
  const extraTime = isLast ? Math.max(0, worked - periodNorm) - periodOvertime : 0;
  // Przekroczenie normy okresu zawsze 100% (art. 151¹ § 2 KP).
  // M6: nadgodziny okresowe wyceniamy średnią stawką godzinową okresu (zarobek z godzin / godziny),
  // a nie ogólną stawką — rodzaje z własną stawką zmieniają wartość godziny.
  const periodMinutes = sum((m) => m.minutes);
  const periodBase = sum((m) => m.base);
  const periodRate = periodMinutes > 0 && periodBase > 0 ? periodBase / (periodMinutes / 60) : data.hourlyRate;
  const premium = c.dailyPremium + (periodOvertime / 60) * periodRate;
  const prefix = monthPrefix(year, month);
  // Premie tego miesiąca (kwoty brutto) dolicza się do zarobku, nie do godzin ani norm.
  const monthKey = prefix.slice(0, -1);
  const bonuses = (data.bonuses ?? []).filter((b) => b.month === monthKey);
  const bonusTotal = round2(bonuses.reduce((acc, b) => acc + b.amount, 0));

  return {
    daysWorked: c.daysWorked,
    minutes: c.minutes,
    nightMinutes: c.night,
    normMinutes: c.normMinutes,
    extraTimeMinutes: extraTime,
    overtimeMinutes: c.dailyOvertime + periodOvertime,
    dailyOvertimeMinutes: c.dailyOvertime,
    overtime100Minutes: c.daily100 + periodOvertime,
    absenceDays: c.absenceDays,
    earnings: round2(c.base + premium + bonusTotal),
    bonuses,
    bonusTotal,
    byType: data.types.map((t) => c.totals.get(t.id)).filter((t): t is ShiftTypeTotal => !!t),
    shortRests: shortRests(data).filter((r) => r.dayKey.startsWith(prefix)),
    period: p.months === 1 ? null : {
      ...p,
      normMinutes: periodNorm,
      // Do bieżącego miesiąca włącznie — tyle, ile już wiadomo.
      minutes: sum((m) => m.minutes, index + 1),
      isLast,
    },
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
  const base = entry && typesById.get(entry.type);
  if (!base || isAbsence(base)) return null;
  const type = dayType(base, entry);
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
