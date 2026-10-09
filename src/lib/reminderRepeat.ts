export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

export const REMINDER_REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: "Nigdy",
  daily: "Codziennie",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
};

/**
 * Zwraca timestamp kolejnego wystąpienia przypomnienia, zachowując tę samą godzinę/minutę.
 *
 * `monthly`: dzień `anchorDay` (albo dzień `current`), a gdy miesiąc jest krótszy —
 * jego ostatni dzień. 31 stycznia → 28/29 lutego → 31 marca. Dawniej `setMonth`
 * przepełniał datę: 31 stycznia → 3 marca.
 */
export function getNextReminderTime(current: number, repeat: ReminderRepeat, anchorDay?: number): number {
  const d = new Date(current);
  switch (repeat) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly": {
      const day = anchorDay ?? d.getDate();
      d.setDate(1); // najpierw 1., żeby zmiana miesiąca nie przepełniła daty
      d.setMonth(d.getMonth() + 1);
      d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
      break;
    }
    case "none":
    default:
      return current;
  }
  return d.getTime();
}

/**
 * Następny termin serii albo `null`, gdy wypadłby po końcu serii (`until`).
 * Jedyne miejsce, które decyduje, czy seria jeszcze trwa — powiadomienia,
 * kalendarz i „pomiń” liczą to samo.
 */
export function nextInSeries(current: number, repeat: ReminderRepeat, anchorDay?: number, until?: number): number | null {
  const next = getNextReminderTime(current, repeat, anchorDay);
  return until !== undefined && next > until ? null : next;
}

/** Koniec wybranego dnia (czas lokalny) — wartość `reminderRepeatUntil`. */
export function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

/**
 * Dzień serii notatki. Notatki sprzed pola `reminderDay` (albo utworzone od razu
 * z terminem) go nie mają — wtedy dzień zapisanego terminu, zanim cokolwiek go przytnie.
 */
export function seriesDay(note: { reminder: number | null; reminderDay?: number }): number | undefined {
  return note.reminderDay ?? (note.reminder !== null ? new Date(note.reminder).getDate() : undefined);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
