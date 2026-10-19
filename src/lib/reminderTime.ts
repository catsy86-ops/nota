import { addDays, format, isSameDay } from "date-fns";
import { pl } from "date-fns/locale";
/**
 * Składanie terminu przypomnienia z daty i godziny „HH:mm”.
 *
 * Wyciągnięte z `ReminderPicker`, bo dokładnie tego samego potrzebują drugi,
 * zduplikowany picker w `AddNoteBar` oraz kalendarz (klik w dzień daje datę,
 * godzina jest osobnym polem).
 */

/** Godzina domyślna, gdy użytkownik wskazał tylko dzień. */
export const DEFAULT_REMINDER_TIME = "09:00";

/**
 * Domyślna godzina nowego terminu na dany dzień: 09:00, a gdy dziś już minęła —
 * najbliższa pełna godzina (do 23:00). Dzięki temu świeży dialog nie zaczyna od błędu „w przeszłości”.
 */
export function defaultReminderTimeFor(day: Date, now: Date = new Date()): string {
  const sameDay = day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
  if (!sameDay) return DEFAULT_REMINDER_TIME;
  const [h, m] = DEFAULT_REMINDER_TIME.split(":").map(Number);
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return DEFAULT_REMINDER_TIME;
  const next = Math.min(now.getHours() + 1, 23);
  return `${String(next).padStart(2, "0")}:00`;
}

/**
 * Data + „HH:mm” → timestamp, albo `null` gdy godzina jest niepełna.
 *
 * `null` zamiast rzucania lub `NaN`: `<input type="time">` bywa pusty (da się
 * go wyczyścić), a `new Date().setHours(NaN)` dawało cicho `NaN` zapisywane
 * potem jako termin przypomnienia.
 */
export function composeReminderTimestamp(date: Date, time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  const ts = d.getTime();
  return Number.isNaN(ts) ? null : ts;
}

/** Czy termin już minął. `null` (niepełna godzina) nie jest „przeszłością”. */
export function isPastReminder(timestamp: number | null, now: number = Date.now()): boolean {
  return timestamp !== null && timestamp < now;
}

/** Timestamp → wartość dla `<input type="time">`. */
export function toTimeInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Krótki podpis terminu: „dziś, 19:10”, „jutro, 08:00”, dalej „3 paź, 19:10”.
 * `allDay`: sama data bez godziny („dziś”, „jutro”, „3 paź”) — termin i tak stoi na 9:00.
 */
export function formatReminderShort(timestamp: number, now: Date = new Date(), allDay = false): string {
  const d = new Date(timestamp);
  const time = allDay ? "" : format(d, "HH:mm");
  const withTime = (day: string) => (allDay ? day : `${day}, ${time}`);
  if (isSameDay(d, now)) return withTime("dziś");
  if (isSameDay(d, addDays(now, 1))) return withTime("jutro");
  if (isSameDay(d, addDays(now, -1))) return withTime("wczoraj");
  return allDay ? format(d, "d MMM", { locale: pl }) : format(d, "d MMM, HH:mm", { locale: pl });
}
