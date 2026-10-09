/**
 * Model danych Grafiku. Zapisywany w localStorage jako jeden dokument
 * z polem `version` — `migrate()` podnosi każdą starszą postać do bieżącej,
 * więc reszta kodu widzi zawsze tylko `ShiftData`.
 */

export type ShiftKind = "work" | "absence";
export type WorkSystem = "basic" | "equivalent";

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
  /** Stawka za godzinę tej zmiany; brak = stawka domyślna. */
  rate?: number;
  /**
   * `work` liczy się do przepracowanych godzin; `absence` (urlop, L4)
   * nie jest pracą, ale obniża normę miesiąca o swój czas.
   * Brak pola = `work` (dane sprzed wprowadzenia nieobecności).
   */
  kind?: ShiftKind;
}

export interface DayEntry {
  /** Id rodzaju zmiany. */
  type: string;
  note?: string;
  /** Odchylenie od planu w minutach: + zostałem dłużej, − wyszedłem wcześniej. */
  extraMin?: number;
}

/** Cykl zmian powtarzany od wybranej daty; `null` = dzień wolny. */
export interface ShiftPattern {
  id: string;
  name: string;
  steps: (string | null)[];
}

export interface ShiftData {
  version: 2;
  types: ShiftType[];
  /** dayKey („2026-10-09”) → wpis dnia. */
  days: Record<string, DayEntry>;
  /** Domyślna stawka za godzinę (zł). 0 = nie licz zarobku. */
  hourlyRate: number;
  /** Mnożnik stawki za nadgodziny (Kodeks pracy: 1,5 lub 2). */
  overtimeMultiplier: number;
  /**
   * System czasu pracy — od niego zależy dobowy limit przed nadgodzinami:
   * `basic` 8 h (art. 129 KP), `equivalent` do 12 h wg grafiku (art. 135 KP).
   */
  workSystem: WorkSystem;
  patterns: ShiftPattern[];
}

export const SHIFT_COLORS = ["#f59e0b", "#3b82f6", "#4f46e5", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#64748b"] as const;

/** Nazwy kolorów palety dla czytników ekranu — „#f59e0b” nic nie mówi. */
export const SHIFT_COLOR_NAMES: Record<(typeof SHIFT_COLORS)[number], string> = {
  "#f59e0b": "bursztynowy",
  "#3b82f6": "niebieski",
  "#4f46e5": "indygo",
  "#10b981": "szmaragdowy",
  "#ef4444": "czerwony",
  "#ec4899": "różowy",
  "#14b8a6": "morski",
  "#64748b": "grafitowy",
};

export const DEFAULT_SHIFT_TYPES: ShiftType[] = [
  { id: "d", name: "Dzień", short: "D", color: "#f59e0b", start: "06:00", end: "14:00", breakMin: 0, kind: "work" },
  { id: "p", name: "Popołudnie", short: "P", color: "#3b82f6", start: "14:00", end: "22:00", breakMin: 0, kind: "work" },
  { id: "n", name: "Noc", short: "N", color: "#4f46e5", start: "22:00", end: "06:00", breakMin: 0, kind: "work" },
  { id: "u", name: "Urlop", short: "U", color: "#10b981", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
  { id: "l4", name: "L4", short: "L4", color: "#64748b", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
];

export const DEFAULT_PATTERNS: ShiftPattern[] = [
  { id: "4b", name: "Czterobrygadowy (2D 2N 4W)", steps: ["d", "d", "n", "n", null, null, null, null] },
  { id: "3z", name: "Trzyzmianowy tydzień po tygodniu", steps: [
    "d", "d", "d", "d", "d", null, null,
    "p", "p", "p", "p", "p", null, null,
    "n", "n", "n", "n", "n", null, null,
  ] },
];

export const EMPTY_SHIFT_DATA: ShiftData = {
  version: 2,
  types: DEFAULT_SHIFT_TYPES,
  days: {},
  hourlyRate: 0,
  overtimeMultiplier: 1.5,
  workSystem: "basic",
  patterns: DEFAULT_PATTERNS,
};

export const isAbsence = (t: Pick<ShiftType, "kind">) => t.kind === "absence";

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
  return entry;
}

/**
 * Dowolna zapisana postać (v1, v2, śmieci) → poprawne `ShiftData`.
 * Pola, których ta wersja nie zna, zostają — zapis ze starszej aplikacji
 * nie kasuje danych dopisanych przez nowszą.
 */
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
    overtimeMultiplier: Math.max(1, num(s.overtimeMultiplier, EMPTY_SHIFT_DATA.overtimeMultiplier)),
    workSystem: s.workSystem === "equivalent" ? "equivalent" : "basic",
    patterns: Array.isArray(s.patterns) ? s.patterns.filter(isPattern) : EMPTY_SHIFT_DATA.patterns,
  };
}
