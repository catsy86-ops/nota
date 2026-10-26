import type { Note } from "@/hooks/useNotes";
import { eveningTime, snoozeTimes } from "@/lib/reminderAgenda";
import { doneTarget, endOfDay, seriesDay, snoozeTarget } from "@/lib/reminderRepeat";

/**
 * Akcje na terminie („Gotowe”, „Jutro”, „+1 h”) bez otwierania notatki. Wspólne dla kafla
 * (`NoteCardBody`), listy „Dziś” i Kalendarza, żeby każde miejsce zapisywało to samo.
 * Funkcje tylko liczą zmianę; zapis, cofnięcie i komunikat robi `ReminderQuickActions`.
 */

/** Pola przypomnienia, które te akcje zmieniają. */
export type ReminderFields = Pick<Note, "reminder" | "reminderDay" | "reminderBase" | "reminderRepeatUntil">;

export type SnoozeKind = "in10" | "inHour" | "evening" | "tomorrow9";

export interface ReminderUpdate {
  patch: Partial<ReminderFields>;
  /** Komunikat z cofnięciem (`toastWithUndo`). */
  message: string;
}

/** Stan sprzed akcji — do cofnięcia. */
export function reminderFields(note: Note): ReminderFields {
  return { reminder: note.reminder, reminderDay: note.reminderDay, reminderBase: note.reminderBase, reminderRepeatUntil: note.reminderRepeatUntil };
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
  const at = kind === "in10" ? now + 10 * 60_000 : kind === "inHour" ? times.inHour : kind === "evening" ? (eveningTime(now) ?? times.tomorrow9) : times.tomorrow9;
  const snz = snoozeTarget(note, at, now);
  return {
    patch: { reminder: snz.reminder, reminderDay: note.reminderDay, reminderBase: snz.reminderBase },
    message: SNOOZE_MESSAGE[kind],
  };
}

/** Pozycje menu „Odłóż” poza przyciskami w rzędzie (2.1): nazwa i chwila odłożenia. */
export const SNOOZE_MENU: { kind: SnoozeKind; label: string }[] = [
  { kind: "in10", label: "Za 10 minut" },
  { kind: "evening", label: "Wieczorem (18:00)" },
];

/** Pozycje menu dostępne teraz: „Wieczorem” znika po 17:30 (`eveningTime`). */
export function snoozeMenuAt(now: number): { kind: SnoozeKind; label: string }[] {
  return SNOOZE_MENU.filter((o) => o.kind !== "evening" || eveningTime(now) !== null);
}

const SNOOZE_MESSAGE: Record<SnoozeKind, string> = {
  in10: "Przesunięto o 10 minut",
  inHour: "Przesunięto o godzinę",
  evening: "Przesunięto na wieczór, 18:00",
  tomorrow9: "Przesunięto na jutro, 9:00",
};

/**
 * „Zakończ serię” (2.4): koniec serii na bieżącym wystąpieniu. Termin zostaje do „Gotowe”, po którym
 * seria nie ma następnego wystąpienia, więc notatka nie ma już terminu. Cofnięcie w toaście.
 */
export function endSeriesUpdate(note: Note): ReminderUpdate | null {
  if (note.reminder === null || !note.reminderRepeat || note.reminderRepeat === "none") return null;
  return {
    patch: { reminderRepeatUntil: endOfDay(new Date(note.reminder)) },
    message: "Seria zakończona na tym wystąpieniu",
  };
}
