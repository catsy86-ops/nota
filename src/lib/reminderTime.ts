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
