export type ReminderRepeat = "none" | "daily" | "weekly" | "monthly";

export const REMINDER_REPEAT_LABELS: Record<ReminderRepeat, string> = {
  none: "Nigdy",
  daily: "Codziennie",
  weekly: "Co tydzień",
  monthly: "Co miesiąc",
};

/** Zwraca timestamp kolejnego wystąpienia przypomnienia, zachowując tę samą godzinę/minutę. */
export function getNextReminderTime(current: number, repeat: ReminderRepeat): number {
  const d = new Date(current);
  switch (repeat) {
    case "daily":
      d.setDate(d.getDate() + 1);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "none":
    default:
      return current;
  }
  return d.getTime();
}
