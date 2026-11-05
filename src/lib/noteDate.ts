import { format, isSameDay, isSameYear } from "date-fns";
import { pl } from "date-fns/locale";

/**
 * Data notatki na karcie (plan nowy 3.1): „dziś 12:00”, „wczoraj 18:30”, a dalej „4 lis, 09:15”.
 * Rok dopisujemy tylko wtedy, gdy nie jest bieżący. `now` podawany z zewnątrz, żeby test był stały.
 */
export function formatNoteDate(at: number, now: Date = new Date()): string {
  const d = new Date(at);
  const hm = format(d, "HH:mm");
  if (isSameDay(d, now)) return `dziś ${hm}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (isSameDay(d, yesterday)) return `wczoraj ${hm}`;
  return isSameYear(d, now) ? format(d, "d MMM, HH:mm", { locale: pl }) : format(d, "d MMM yyyy, HH:mm", { locale: pl });
}
