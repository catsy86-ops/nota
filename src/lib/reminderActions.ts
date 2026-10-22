import type { Note } from "@/hooks/useNotes";
import { snoozeTimes } from "@/lib/reminderAgenda";
import { doneTarget, seriesDay, snoozeTarget } from "@/lib/reminderRepeat";

/**
 * Akcje na terminie („Gotowe”, „Jutro”, „+1 h”) bez otwierania notatki. Wspólne dla kafla
 * (`NoteCardBody`), listy „Dziś” i Kalendarza, żeby każde miejsce zapisywało to samo.
 * Funkcje tylko liczą zmianę; zapis, cofnięcie i komunikat robi `ReminderQuickActions`.
 */

/** Pola przypomnienia, które te akcje zmieniają. */
export type ReminderFields = Pick<Note, "reminder" | "reminderDay" | "reminderBase">;

export type SnoozeKind = "inHour" | "tomorrow9";

export interface ReminderUpdate {
  patch: Partial<ReminderFields>;
  /** Komunikat z cofnięciem (`toastWithUndo`). */
  message: string;
}

/** Stan sprzed akcji — do cofnięcia. */
export function reminderFields(note: Note): ReminderFields {
  return { reminder: note.reminder, reminderDay: note.reminderDay, reminderBase: note.reminderBase };
}

/**
 * „Gotowe”: w serii przechodzi do następnego wystąpienia, koniec serii albo zwykły termin zdejmuje przypomnienie.
 */
export function doneReminderUpdate(note: Note, now: number): ReminderUpdate {
  const next = doneTarget(note, now);
  if (next === null) return { patch: { reminder: null }, message: "Przypomnienie odhaczone" };
  return {
    patch: { reminder: next, reminderDay: seriesDay(note), reminderBase: undefined },
    message: "Wystąpienie odhaczone — następne w serii",
  };
}

/**
 * „Jutro 9:00” albo „Za godzinę”: odkłada jedno wystąpienie serii (`snoozeTarget`), nie całą serię.
 * `reminderDay` zostaje jawnie — bez tego zapis wyprowadziłby dzień serii z nowej godziny.
 */
export function snoozeReminderUpdate(note: Note, kind: SnoozeKind, now: number): ReminderUpdate {
  const times = snoozeTimes(now);
  const snz = snoozeTarget(note, kind === "inHour" ? times.inHour : times.tomorrow9, now);
  return {
    patch: { reminder: snz.reminder, reminderDay: note.reminderDay, reminderBase: snz.reminderBase },
    message: kind === "inHour" ? "Przesunięto o godzinę" : "Przesunięto na jutro, 9:00",
  };
}
