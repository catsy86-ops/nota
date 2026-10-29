import { composeReminderTimestamp } from "@/lib/reminderTime";
import { timelineHours, type TimelinePiece } from "@/lib/dayTimeline";

/**
 * Oś tygodnia z godzinami (K3.6) — czysta logika: wspólny zakres godzin dla siedmiu kolumn
 * i przeliczenie przeciągnięcia na dzień i godzinę. Minuty liczone od północy dnia.
 */

/** Dane jednej kolumny (dnia) potrzebne do ustalenia zakresu osi. */
export interface WeekAxisDay {
  pieces: TimelinePiece[];
  /** Minuty od północy każdego terminu z tego dnia (bez „cały dzień”). */
  minutes: number[];
}

/** Wspólny zakres godzin dla wszystkich dni tygodnia, [from, to) w pełnych godzinach. */
export function weekAxisHours(days: WeekAxisDay[]): { from: number; to: number } {
  return timelineHours(
    days.flatMap((d) => d.pieces),
    days.flatMap((d) => d.minutes),
  );
}

/** Pozycja minuty na osi w procentach wysokości kolumny (od `from` godziny w górę). */
export function axisPercent(minute: number, from: number, to: number): number {
  return ((minute - from * 60) / ((to - from) * 60)) * 100;
}

/**
 * Nowy termin po przeciągnięciu: ten sam dzień i minuta co dotąd, ale w dniu `day`
 * i w godzinie `hour` (pełna godzina). `null`, gdy tej godziny nie ma (zmiana czasu) —
 * wtedy nic nie przesuwamy po cichu.
 */
export function retimedAt(day: Date, hour: number, minute: number): number | null {
  const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return composeReminderTimestamp(day, clock);
}
