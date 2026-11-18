import type { Note } from "@/lib/types/note";
import { doneReminderUpdate, reminderFields, type ReminderFields } from "@/lib/reminderActions";
import { endOfDay } from "@/lib/reminderRepeat";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import type { Supplement } from "./model";

/**
 * Odhaczenie odżywki ↔ „Gotowe” na jej przypomnieniu (C1.4, `docs/plan-zgodnosc-i-obieg.md` §2.4). Prawda jest w kluczu
 * `dzień|id` (`supplementLog`); termin w notatce to skutek. Każdy krok ma warunek, który po wykonaniu jest fałszywy, więc
 * drugie wywołanie (ten telefon albo drugi po synchronizacji) nic nie zmienia, a żadna funkcja nie woła drugiej — pętli nie ma.
 */

export interface TakeDeps {
  getNote(id: string): Note | undefined;
  updateNote(id: string, patch: Partial<ReminderFields>): void;
  transact(fn: () => void): void;
  now(): number;
  supplements(): readonly Supplement[];
  isTaken(day: string, supplementId: string): boolean;
  markTaken(day: string, supplementId: string, on: boolean): void;
}

export interface TakeResult {
  changed: boolean;
  undo(): void;
}

const NOTHING: TakeResult = { changed: false, undo: () => {} };

/** Notatka-przypomnienie z dzienną serią, której bieżące wystąpienie wypada najpóźniej dziś. */
function dueToday(note: Note | undefined, now: number): note is Note {
  if (!note || note.trashed || note.reminder === null || note.reminder === undefined) return false;
  if (note.reminderRepeat !== "daily" || (note.reminderRule && note.reminderRule.kind !== "daily")) return false;
  return note.reminder <= endOfDay(new Date(now));
}

/**
 * Odhaczenie z listy, w jednej transakcji. `on`: klucz (gdy go nie ma) i — dla dzisiejszego dnia — przesunięcie dzisiejszego
 * wystąpienia przypomnienia na jutro. `!on`: tylko zdjęcie klucza; notatki nie rusza.
 */
export function setTaken(deps: TakeDeps, s: Supplement, day: string, on: boolean): TakeResult {
  const now = deps.now();
  let added = false;
  let removed = false;
  let prevFields: ReminderFields | null = null;
  let noteId: string | null = null;
  deps.transact(() => {
    const has = deps.isTaken(day, s.id);
    if (!on) {
      if (has) { deps.markTaken(day, s.id, false); removed = true; }
      return;
    }
    if (!has) { deps.markTaken(day, s.id, true); added = true; }
    if (day !== localDayKey(new Date(now)) || !s.reminderNoteId) return;
    const note = deps.getNote(s.reminderNoteId);
    if (!dueToday(note, now)) return;
    prevFields = reminderFields(note);
    noteId = note.id;
    deps.updateNote(note.id, doneReminderUpdate(note, now).patch);
  });
  if (!added && !removed && !noteId) return NOTHING;
  return {
    changed: true,
    undo: () => deps.transact(() => {
      if (added) deps.markTaken(day, s.id, false);
      if (removed) deps.markTaken(day, s.id, true);
      if (noteId && prevFields) deps.updateNote(noteId, prevFields);
    }),
  };
}

/**
 * „Gotowe” na przypomnieniu odżywki: odhacza ją w dniu wystąpienia, ale tylko dziś albo wczoraj (powiadomienie z 23:58
 * stuknięte po północy). Starszego wystąpienia nie odhacza — nie wiadomo, czy odżywka była wzięta. Notatki nie rusza:
 * łatkę „Gotowe” zapisał już ten, kto je obsłużył.
 */
export function takenFromReminder(deps: TakeDeps, noteId: string, occurrence: number): TakeResult {
  const s = deps.supplements().find((x) => x.reminderNoteId === noteId);
  if (!s) return NOTHING;
  const today = localDayKey(new Date(deps.now()));
  const day = localDayKey(new Date(occurrence));
  if (day !== today && day !== addDaysToKey(today, -1)) return NOTHING;
  let added = false;
  deps.transact(() => {
    if (!deps.isTaken(day, s.id)) { deps.markTaken(day, s.id, true); added = true; }
  });
  if (!added) return NOTHING;
  return { changed: true, undo: () => deps.transact(() => deps.markTaken(day, s.id, false)) };
}
