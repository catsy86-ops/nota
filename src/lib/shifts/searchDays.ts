import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { dayType, type DayEntry, type ShiftType } from "./model";
import { holidayName } from "./holidays";
import { shiftLabel } from "./eveningNudge";

export interface ShiftDayHit {
  /** `yyyy-MM-dd`. */
  key: string;
  /** „czwartek, 8 października”. */
  dateLabel: string;
  /** „Dniówka 08:00–16:00”. */
  shiftLabel: string;
  type: ShiftType;
  note?: string;
}

const MIN_QUERY = 2;
const LIMIT = 8;

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Słowo zapytania pasuje do początku słowa dnia albo odwrotnie („nocka” ↔ „Noc”). */
const wordMatches = (token: string, w: string) => w.startsWith(token) || (w.length >= 3 && token.startsWith(w));

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Dni grafiku pasujące do zapytania: po nazwie i skrócie zmiany, notatce dnia,
 * dacie („12 października”), dniu tygodnia i nazwie święta. Najbliższe dni
 * (od dziś w przód, potem wstecz) idą pierwsze.
 */
export function searchShiftDays(
  query: string,
  days: Record<string, DayEntry>,
  typesById: Map<string, ShiftType>,
  today: Date = new Date(),
): ShiftDayHit[] {
  const tokens = words(query);
  if (query.trim().length < MIN_QUERY || tokens.length === 0) return [];

  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const hits: { hit: ShiftDayHit; dist: number }[] = [];

  for (const [key, entry] of Object.entries(days)) {
    const base = typesById.get(entry.type);
    if (!base) continue;
    const type = dayType(base, entry);
    const date = parseKey(key);
    const dateLabel = format(date, "EEEE, d MMMM", { locale: pl });
    const holiday = holidayName(key);
    const hay = words([type.name, type.short, entry.note ?? "", dateLabel, format(date, "yyyy"), holiday ?? ""].join(" "));
    if (!tokens.every((t) => hay.some((w) => wordMatches(t, w)))) continue;

    const diff = date.getTime() - todayMs;
    // Przyszłość przed przeszłością: przyszłe dni po rosnącej odległości, minione za nimi.
    hits.push({ hit: { key, dateLabel, shiftLabel: shiftLabel(type), type, note: entry.note }, dist: diff >= 0 ? diff : 1e15 - diff });
  }

  return hits.sort((a, b) => a.dist - b.dist).slice(0, LIMIT).map((h) => h.hit);
}
