/**
 * Model danych Grafiku. Zapisywany w localStorage jako jeden dokument
 * z polem `version` — `migrate()` podnosi każdą starszą postać do bieżącej,
 * więc reszta kodu widzi zawsze tylko `ShiftData`.
 */

export type ShiftKind = "work" | "absence";
/** Rodzaj nieobecności: urlop wypoczynkowy, zwolnienie lekarskie (L4), pozostałe. */
export type AbsenceKind = "leave" | "sick" | "other";
export const ABSENCE_KINDS: AbsenceKind[] = ["leave", "sick", "other"];
export type WorkSystem = "basic" | "equivalent";
/** Długość okresu rozliczeniowego w miesiącach (art. 129 KP). */
export type SettlementMonths = 1 | 2 | 3 | 4 | 6 | 12;
export const SETTLEMENT_MONTHS: SettlementMonths[] = [1, 2, 3, 4, 6, 12];
/** Typowe wymiary etatu: [ułamek, etykieta]. */
export const FTE_OPTIONS: [number, string][] = [[1, "Pełny etat"], [7 / 8, "7/8"], [4 / 5, "4/5"], [3 / 4, "3/4"], [3 / 5, "3/5"], [1 / 2, "1/2"], [2 / 5, "2/5"], [1 / 4, "1/4"]];

export interface ShiftType {
  id: string;
  name: string;
  /** Skrót w komórce kalendarza, 1–3 znaki. */
  short: string;
  color: string;
  /** „HH:MM”. */
  start: string;
  end: string;
  /** Niepłatna przerwa w minutach. */
  breakMin: number;
  /**
   * Początek przerwy „HH:MM”. Brak = przerwa nieumiejscowiona, liczona tak,
   * jakby skracała koniec zmiany.
   */
  breakAt?: string;
  /**
   * Ile minut przed początkiem zmiany ma zadzwonić alarm w eksporcie do kalendarza.
   * `0` = bez alarmu; brak = alarm domyślny eksportu.
   */
  alarmMin?: number;
  /** Stawka za godzinę tej zmiany; brak = stawka domyślna. */
  rate?: number;
  /**
   * `work` liczy się do przepracowanych godzin; `absence` (urlop, L4)
   * nie jest pracą, ale obniża normę miesiąca o swój czas.
   * Brak pola = `work` (dane sprzed wprowadzenia nieobecności).
   */
  kind?: ShiftKind;
  /**
   * Rodzaj nieobecności (tylko przy `kind: "absence"`). Brak pola = wykryty
   * po nazwie (`absenceKindOf`) — dane sprzed wprowadzenia pola.
   */
  absenceKind?: AbsenceKind;
  /** Pozycja na pasku — kolejność kluczy Y.Map nie jest wspólna dla urządzeń. */
  order?: number;
}

export interface DayEntry {
  /** Id rodzaju zmiany. */
  type: string;
  note?: string;
  /** Odchylenie od planu w minutach: + zostałem dłużej, − wyszedłem wcześniej. */
  extraMin?: number;
  /**
   * Praca w dzień wolny według grafiku (dopisana poza planem). Ma znaczenie
   * w niedzielę i święto: nadgodziny w taki dzień mają dodatek 100%,
   * a w zaplanowany — 50% (art. 151¹ § 1 KP).
   */
  offSchedule?: true;
  /**
   * Praca w dzień wolny udzielony w zamian za pracę w niedzielę lub święto —
   * nadgodziny w taki dzień mają dodatek 100% (art. 151¹ § 1 pkt 1 lit. c KP).
   */
  inLieu?: true;
  /**
   * Godziny rodzaju z dnia, w którym była ta zmiana — zapisywane, gdy ktoś
   * później zmieni godziny rodzaju. Brak = bieżące godziny rodzaju.
   */
  /**
   * Godziny zmiany, którą ten dzień zastąpił urlopem (minuty z grafiku, art. 154² KP).
   * Brak = 8 h × etat (wpisy urlopu sprzed tego pola).
   */
  plannedMin?: number;
  /**
   * Odbiór nadgodzin tym dniem nieobecności: przelicznik 1 (1:1) albo 1,5 (1:1,5, art. 151² KP).
   * Dzień odbiera godziny swojej zmiany, przeliczone przez ten przelicznik.
   */
  timeOff?: 1 | 1.5;
  hours?: ShiftHours;
  /**
   * `hours` wpisał użytkownik ręcznie dla tego dnia (nie jest to kopia z rodzaju),
   * więc zostaje także po przeniesieniu wpisu na przyszły dzień.
   */
  customHours?: true;
}

export type ShiftHours = Pick<ShiftType, "start" | "end" | "breakMin" | "breakAt">;

/** Rodzaj zmiany z godzinami, które obowiązywały w danym dniu. */
export function dayType(type: ShiftType, entry: Pick<DayEntry, "hours"> | undefined): ShiftType {
  return entry?.hours ? { ...type, ...entry.hours } : type;
}

const HM = /^\d{1,2}:\d{2}$/;
const isHours = (h: unknown): h is ShiftHours => {
  const o = h as ShiftHours;
  return !!o && typeof o.start === "string" && HM.test(o.start) && typeof o.end === "string" && HM.test(o.end)
    && typeof o.breakMin === "number" && Number.isFinite(o.breakMin) && o.breakMin >= 0
    && (o.breakAt === undefined || (typeof o.breakAt === "string" && HM.test(o.breakAt)));
};

/** Godziny rodzaju do zapamiętania w dniu — `breakAt` tylko, gdy jest. */
export function shiftHours(t: ShiftHours): ShiftHours {
  return t.breakAt ? { start: t.start, end: t.end, breakMin: t.breakMin, breakAt: t.breakAt } : { start: t.start, end: t.end, breakMin: t.breakMin };
}

/** Cykl zmian powtarzany od wybranej daty; `null` = dzień wolny. */
export interface ShiftPattern {
  id: string;
  name: string;
  steps: (string | null)[];
  order?: number;
  /** Kotwica: dzień pierwszego kroku cyklu (dayKey). Faza każdego dnia liczy się od niej; brak = od dnia nałożenia. */
  anchor?: string;
  /** Ostatni dzień, na który cykl został nałożony (dayKey). „Przedłuż cykl” zaczyna od następnego. */
  appliedUntil?: string;
  /**
   * `week` = szablon tygodnia (G4.6): zawsze 7 kroków od poniedziałku (indeks 0 = pn),
   * trzymany osobno od cykli. Brak pola = cykl.
   */
  kind?: "week";
}

export interface ShiftData {
  version: 2;
  types: ShiftType[];
  /** dayKey („2026-10-09”) → wpis dnia. */
  days: Record<string, DayEntry>;
  /** Domyślna stawka za godzinę (zł). 0 = nie licz zarobku. */
  hourlyRate: number;
  /** Dodatek nocny w zł/h (ręcznie). 0 = z minimalnej stawki roku (art. 151⁸ KP) — `nightAllowance.ts`. */
  nightRate: number;
  /**
   * System czasu pracy — od niego zależy dobowy limit przed nadgodzinami:
   * `basic` 8 h (art. 129 KP), `equivalent` do 12 h wg grafiku (art. 135 KP).
   */
  workSystem: WorkSystem;
  /** Okres rozliczeniowy; nadgodziny ponad normę rozlicza się w jego ostatnim miesiącu. */
  settlementMonths: SettlementMonths;
  /** Miesiąc (0–11), od którego liczą się kolejne okresy — np. kwartały od lutego. */
  settlementStart: number;
  /** Wymiar etatu, (0, 1]; norma okresu jest proporcjonalna. */
  fte: number;
  /** Roczny wymiar urlopu wypoczynkowego w dniach (20 albo 26 wg stażu), 0–99. */
  leaveDays: number;
  /**
   * Niepełny etat: od jakiego wymiaru praca jest już nadgodzinami z dodatkiem
   * (art. 151 § 5 KP — strony ustalają to w umowie). 1 = dopiero ponad pełny
   * etat; poniżej `fte` nie schodzi.
   */
  overtimeFrom: number;
  /**
   * Godzina (0–23), od której liczy się doba niedzieli i święta — do tej
   * godziny następnego dnia (art. 151¹⁰ KP: 6:00, chyba że pracodawca ustalił inną).
   */
  sundayFrom: number;
  /** Początek pory nocnej: 21, 22 albo 23 — trwa 8 h, między 21 a 7 (art. 151⁷ KP). */
  nightFrom: number;
  /**
   * Alarm przed zmianą (G4.1, G-6): ile minut przed początkiem przypomnieć push. `undefined` = domyślnie
   * `SHIFT_ALARM_DEFAULT_MIN`, `0` = wyłączony. Ustawienie jest per grafik.
   */
  alarmBeforeMin?: number;
  patterns: ShiftPattern[];
  /** Premie w rachunku (zł brutto), przypisane do miesiąca. Doliczane do zarobku tego miesiąca. */
  bonuses: ShiftBonus[];
  /** Wypłacono brutto (zł) wg paska, per miesiąc `YYYY-MM` (B5). Brak wpisu = nie wpisano. */
  paidGross?: Record<string, number>;
}

/** Premia jednorazowa w danym miesiącu (np. nagroda, dodatek za wyjazd). */
export interface ShiftBonus {
  id: string;
  /** Miesiąc `YYYY-MM`, do którego należy premia. */
  month: string;
  name: string;
  /** Kwota brutto w zł, > 0. */
  amount: number;
}

export const BONUS_NAME_MAX = 40;
export const BONUS_MAX_AMOUNT = 1_000_000;
export const BONUS_MAX_PER_DATA = 500;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Dane premii z zewnątrz (kopia, peer) → poprawna premia albo `null`. */
export function cleanBonus(raw: unknown): ShiftBonus | null {
  const b = raw as Partial<ShiftBonus> | null;
  if (!b || typeof b !== "object") return null;
  if (typeof b.id !== "string" || !b.id || b.id.length > 64) return null;
  if (typeof b.month !== "string" || !MONTH_RE.test(b.month)) return null;
  if (typeof b.name !== "string" || !b.name.trim()) return null;
  if (typeof b.amount !== "number" || !Number.isFinite(b.amount)) return null;
  // L13: najpierw grosze, potem sprawdzenie — 0,004 zł to 0 zł i nie jest premią.
  const amount = Math.round(b.amount * 100) / 100;
  if (amount <= 0 || amount > BONUS_MAX_AMOUNT) return null;
  return { id: b.id, month: b.month, name: b.name.trim().slice(0, BONUS_NAME_MAX), amount };
}

export const SHIFT_COLORS = ["#f59e0b", "#3b82f6", "#4f46e5", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#64748b", "#fb923c"] as const;

/** Kolory do wyboru dla nowego rodzaju (G2.6): bez bursztynu marki i czerwieni świąt, żeby nie myliły się z nimi. Istniejące rodzaje zachowują swoje kolory. */
export const NEW_SHIFT_COLORS = SHIFT_COLORS.filter((c) => c !== "#f59e0b" && c !== "#ef4444");

/** Nazwy kolorów palety dla czytników ekranu — „#f59e0b” nic nie mówi. */
export const SHIFT_COLOR_NAMES: Record<(typeof SHIFT_COLORS)[number], string> = {
  "#f59e0b": "bursztynowy",
  "#fb923c": "pomarańczowy",
  "#3b82f6": "niebieski",
  "#4f46e5": "indygo",
  "#10b981": "szmaragdowy",
  "#ef4444": "czerwony",
  "#ec4899": "różowy",
  "#14b8a6": "morski",
  "#64748b": "grafitowy",
};

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  { id: "u", name: "Urlop", short: "U", color: "#10b981", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
  { id: "l4", name: "L4", short: "L4", color: "#64748b", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
  // Dwie zmiany startowe: 8 h (8–16) i 10 h (7–17). Pozostałe dodaje się ręcznie.
  { id: "e", name: "Dniówka", short: "8", color: "#ec4899", start: "08:00", end: "16:00", breakMin: 0, kind: "work" },
  { id: "b", name: "Budowa", short: "B", color: "#14b8a6", start: "07:00", end: "17:00", breakMin: 0, kind: "work" },
];

// Patterny startowe stały na zmianach 6–14, 14–22 i nocnej, które usunięto z domyślnych.
export const DEFAULT_PATTERNS: ShiftPattern[] = [];

/** Alarm przed zmianą (G4.1, G-6): domyślnie godzina przed początkiem; 0 wyłącza. */
export const SHIFT_ALARM_DEFAULT_MIN = 60;
export const SHIFT_ALARM_OPTIONS = [0, 30, 60, 90] as const;

export const EMPTY_SHIFT_DATA: ShiftData = {
  version: 2,
  types: DEFAULT_SHIFT_TYPES,
  days: {},
  hourlyRate: 0,
  nightRate: 0,
  workSystem: "basic",
  settlementMonths: 1,
  settlementStart: 0,
  fte: 1,
  leaveDays: 20,
  overtimeFrom: 1,
  sundayFrom: 6,
  nightFrom: 22,
  patterns: DEFAULT_PATTERNS,
  bonuses: [],
};

export const DEFAULT_LEAVE_DAYS = 20;

export const isAbsence = (t: Pick<ShiftType, "kind">) => t.kind === "absence";

/** Urlopy, które nie są wypoczynkowym i nie ubywają z rocznej puli. */
const NOT_ANNUAL_LEAVE = /bezp[łl]atn|wychowaw|okoliczno|macierzy|rodzicielsk|ojcowsk|szkoleniow/i;

/**
 * Rodzaj nieobecności: jawny `absenceKind`, a dla danych sprzed jego
 * wprowadzenia — po nazwie („Urlop” = urlop, „L4”/„chorobowe” = zwolnienie).
 * `undefined` dla zmian pracy.
 */
export function absenceKindOf(t: Pick<ShiftType, "kind" | "name" | "absenceKind">): AbsenceKind | undefined {
  if (!isAbsence(t)) return undefined;
  if (t.absenceKind && ABSENCE_KINDS.includes(t.absenceKind)) return t.absenceKind;
  const name = (t.name ?? "").trim();
  if (/urlop/i.test(name) && !NOT_ANNUAL_LEAVE.test(name)) return "leave";
  if (/^l-?4\b|chorob|zwolnieni|zasi[łl]ek/i.test(name)) return "sick";
  return "other";
}

function isShiftType(t: unknown): t is ShiftType {
  const o = t as ShiftType;
  return !!o && typeof o.id === "string" && typeof o.name === "string" && typeof o.start === "string" && typeof o.end === "string";
}

/** Naprawia pola liczbowe i znakowe; nieznane pola (z nowszej wersji aplikacji) zostają. */
function cleanType(t: ShiftType): ShiftType {
  const out: ShiftType = {
    ...t,
    short: typeof t.short === "string" && t.short ? t.short : t.name.slice(0, 1).toUpperCase(),
    color: typeof t.color === "string" ? t.color : SHIFT_COLORS[0],
    breakMin: typeof t.breakMin === "number" && Number.isFinite(t.breakMin) ? Math.max(0, t.breakMin) : 0,
    kind: t.kind === "absence" ? "absence" : "work",
  };
  if (!(typeof t.rate === "number" && Number.isFinite(t.rate) && t.rate > 0)) delete out.rate;
  // Rodzaj nieobecności: brak pola w starych danych dopełniamy wykryciem po nazwie.
  if (out.kind === "absence") out.absenceKind = absenceKindOf({ kind: "absence", name: t.name, absenceKind: ABSENCE_KINDS.includes(t.absenceKind as AbsenceKind) ? t.absenceKind : undefined });
  else delete out.absenceKind;
  if (!(typeof t.breakAt === "string" && HM.test(t.breakAt))) delete out.breakAt;
  if (!(Number.isInteger(t.alarmMin) && (t.alarmMin as number) >= 0 && (t.alarmMin as number) <= 1440) || out.kind === "absence") delete out.alarmMin;
  return out;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isPattern(p: unknown): p is ShiftPattern {
  const o = p as ShiftPattern;
  return !!o && typeof o.id === "string" && typeof o.name === "string" && Array.isArray(o.steps);
}

function toEntry(v: unknown): DayEntry | null {
  // v1 trzymało w dniu sam identyfikator zmiany.
  if (typeof v === "string") return { type: v };
  const o = v as DayEntry;
  if (!o || typeof o !== "object" || typeof o.type !== "string") return null;
  // Nieznane pola (np. z nowszej wersji na innym urządzeniu) przechodzą dalej.
  const entry: DayEntry = { ...o, type: o.type };
  if (!(typeof o.note === "string" && o.note.trim())) delete entry.note;
  if (typeof o.extraMin === "number" && Number.isFinite(o.extraMin) && o.extraMin !== 0) entry.extraMin = Math.round(o.extraMin);
  else delete entry.extraMin;
  if (o.offSchedule === true) entry.offSchedule = true;
  else delete entry.offSchedule;
  if (o.inLieu === true) entry.inLieu = true;
  else delete entry.inLieu;
  if (Number.isInteger(o.plannedMin) && (o.plannedMin as number) > 0 && (o.plannedMin as number) <= 1440) entry.plannedMin = o.plannedMin;
  else delete entry.plannedMin;
  if (o.timeOff === 1 || o.timeOff === 1.5) entry.timeOff = o.timeOff;
  else delete entry.timeOff;
  if (isHours(o.hours)) entry.hours = shiftHours(o.hours);
  else delete entry.hours;
  if (o.customHours === true && entry.hours) entry.customHours = true;
  else delete entry.customHours;
  return entry;
}

/**
 * Dowolna zapisana postać (v1, v2, śmieci) → poprawne `ShiftData`.
 * Pola, których ta wersja nie zna, zostają — zapis ze starszej aplikacji
 * nie kasuje danych dopisanych przez nowszą.
 */
/** Wypłaty brutto per miesiąc: tylko klucze `YYYY-MM` z dodatnią, rozsądną kwotą (B5). */
export function cleanPaidGross(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [month, v] of Object.entries(raw as Record<string, unknown>)) {
    if (MONTH_RE.test(month) && typeof v === "number" && Number.isFinite(v) && v > 0 && v <= BONUS_MAX_AMOUNT) out[month] = Math.round(v * 100) / 100;
  }
  return out;
}

export function migrate(stored: unknown): ShiftData {
  const s = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const days: Record<string, DayEntry> = {};
  if (s.days && typeof s.days === "object") {
    for (const [key, v] of Object.entries(s.days as Record<string, unknown>)) {
      if (!DAY_KEY.test(key)) continue;
      const entry = toEntry(v);
      if (entry) days[key] = entry;
    }
  }
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return {
    ...s,
    version: 2,
    types: Array.isArray(s.types) ? s.types.filter(isShiftType).map(cleanType) : EMPTY_SHIFT_DATA.types,
    days,
    hourlyRate: Math.max(0, num(s.hourlyRate, 0)),
    nightRate: Math.max(0, num(s.nightRate, 0)),
    workSystem: s.workSystem === "equivalent" ? "equivalent" : "basic",
    fte: typeof s.fte === "number" && s.fte > 0 && s.fte <= 1 ? s.fte : 1,
    leaveDays: Number.isInteger(s.leaveDays) && (s.leaveDays as number) >= 0 && (s.leaveDays as number) <= 99 ? (s.leaveDays as number) : DEFAULT_LEAVE_DAYS,
    overtimeFrom: typeof s.overtimeFrom === "number" && s.overtimeFrom > 0 && s.overtimeFrom <= 1 ? s.overtimeFrom : 1,
    settlementMonths: SETTLEMENT_MONTHS.includes(s.settlementMonths as SettlementMonths) ? (s.settlementMonths as SettlementMonths) : 1,
    settlementStart: Number.isInteger(s.settlementStart) && (s.settlementStart as number) >= 0 && (s.settlementStart as number) < 12 ? (s.settlementStart as number) : 0,
    sundayFrom: Number.isInteger(s.sundayFrom) && (s.sundayFrom as number) >= 0 && (s.sundayFrom as number) < 24 ? (s.sundayFrom as number) : 6,
    nightFrom: s.nightFrom === 21 || s.nightFrom === 23 ? s.nightFrom : 22,
    ...(Number.isInteger(s.alarmBeforeMin) && (s.alarmBeforeMin as number) >= 0 && (s.alarmBeforeMin as number) <= 240 ? { alarmBeforeMin: s.alarmBeforeMin as number } : {}),
    patterns: Array.isArray(s.patterns) ? s.patterns.filter(isPattern) : EMPTY_SHIFT_DATA.patterns,
    bonuses: Array.isArray(s.bonuses) ? s.bonuses.slice(0, BONUS_MAX_PER_DATA).map(cleanBonus).filter((b): b is ShiftBonus => !!b) : [],
    paidGross: cleanPaidGross(s.paidGross),
  };
}
