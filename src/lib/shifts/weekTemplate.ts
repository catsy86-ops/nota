import { startOfWeekKey } from "../week";
import { isAbsence, type DayEntry, type ShiftPattern, type ShiftType } from "./model";
import { addDaysKey } from "./pattern";

/** Liczba kroków szablonu tygodnia — po jednym na dzień od poniedziałku. */
export const WEEK_TEMPLATE_LENGTH = 7;

/**
 * Szablon z tygodnia zaczynającego się w `weekStart` (poniedziałek): dzień → id zmiany.
 * Pusty dzień, nieobecność (urlop, L4) i rodzaj, którego już nie ma, dają `null` — szablon
 * ich nie niesie, bo nieobecności są chronione przy nakładaniu.
 */
export function weekTemplateSteps(days: Record<string, DayEntry>, weekStart: string, types: ShiftType[]): (string | null)[] {
  const work = new Set(types.filter((t) => !isAbsence(t)).map((t) => t.id));
  return Array.from({ length: WEEK_TEMPLATE_LENGTH }, (_, i) => {
    const entry = days[addDaysKey(weekStart, i)];
    return entry && work.has(entry.type) ? entry.type : null;
  });
}

/** Czy w szablonie jest choć jedna zmiana — pusty tydzień nie da sensownego szablonu. */
export const hasWorkSteps = (steps: (string | null)[]): boolean => steps.some((s) => s !== null);

/** Szablony tygodnia z zapisanych cykli (kind `week`), w kolejności zapisu. */
export const weekTemplates = (patterns: ShiftPattern[]): ShiftPattern[] => patterns.filter((p) => p.kind === "week");

/** Cykle bez szablonów tygodnia — tylko one trafiają do listy „Cykl zmian”. */
export const cyclePatterns = (patterns: ShiftPattern[]): ShiftPattern[] => patterns.filter((p) => p.kind !== "week");

/**
 * Zakres do nałożenia szablonu: kotwicą jest poniedziałek tygodnia zawierającego `startKey`,
 * więc krok 0 zawsze trafia na poniedziałek, niezależnie od tego, od którego dnia zaczynamy.
 */
export function weekTemplateAnchor(startKey: string): string {
  return startOfWeekKey(startKey);
}
