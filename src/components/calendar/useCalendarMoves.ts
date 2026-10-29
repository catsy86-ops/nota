import { format, isSameDay, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import type { DragEndEvent } from "@dnd-kit/core";
import { composeReminderTimestamp } from "@/lib/reminderTime";
import { nextInSeries, nextOccurrence, ruleOf, seriesDay, type RepeatInput, type RepeatRule } from "@/lib/reminderRepeat";
import { dayKey, type Occurrence } from "@/lib/reminderOccurrences";
import { toastWithUndo } from "@/lib/undoToast";
import type { Note } from "@/hooks/useNotes";
import { markMoved } from "./movedSignal";
import { retimedAt } from "@/lib/weekAxis";

interface CalendarMovesArgs {
  notesById: Map<string, Note>;
  onSetReminder: (noteId: string, reminder: number | null, repeat: RepeatInput, reminderDay?: number, reminderBase?: number, reminderAllDay?: boolean, until?: number) => void;
  month: Date;
  setMonth: (month: Date) => void;
  selectedDay: Date;
  setSelectedDay: (day: Date) => void;
}

/**
 * Akcje na terminach z kalendarza (K5.2): dodanie, pominięcie, usunięcie, przeniesienie
 * i przeciągnięcie chipa. Każda zapisuje przez `onSetReminder` i ma cofnięcie w toaście.
 */
export function useCalendarMoves({ notesById, onSetReminder, month, setMonth, selectedDay, setSelectedDay }: CalendarMovesArgs) {
  /** Cofnięcie przywraca poprzedni termin, więc zapamiętujemy go przed zmianą. */
  function previousOf(noteId: string) {
    const note = notesById.get(noteId);
    return {
      reminder: note?.reminder ?? null,
      repeat: note ? ruleOf(note) : { kind: "none" as const },
      day: note ? seriesDay(note) : undefined,
      until: note?.reminderRepeatUntil,
      base: note?.reminderBase,
      allDay: note?.reminderAllDay === true,
    };
  }

  /**
   * Po akcji na terminie jego chip może zniknąć (przeniesiony, pominięty, usunięty),
   * więc fokus ląduje na komórce dnia, a nie wraca na początek strony (2a planu).
   */
  function focusDay(day: Date) {
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-day-key="${dayKey(day)}"]`)?.focus());
  }

  function handleAttach(noteId: string, reminder: number, repeat: RepeatInput, allDay: boolean, base?: number, until?: number) {
    const before = previousOf(noteId);
    onSetReminder(noteId, reminder, repeat, undefined, base, allDay, until);
    toastWithUndo("Termin zapisany", () => onSetReminder(noteId, before.reminder, before.repeat, before.day, before.base, before.allDay, before.until), { icon: "🔔" });
  }

  /**
   * „Pomiń to wystąpienie” = przesuń zapisany termin na kolejny w serii.
   * Zwykły zapis pola, zero nowych struktur — dokładnie to samo, co robi
   * `useReminderNotifications` po odpaleniu przypomnienia.
   */
  function handleSkip(noteId: string, at: number, repeat: RepeatRule) {
    const before = previousOf(noteId);
    const note = notesById.get(noteId);
    // Odłożone wystąpienie: kolejny termin liczy się od serii (`nextOccurrence`), nie od odłożonej chwili.
    const next = note ? nextOccurrence(note, at) : nextInSeries(at, repeat, before.day, before.until);
    // Pominięcie ostatniego terminu serii kończy ją — nie ma już czego przypominać.
    if (next === null) onSetReminder(noteId, null, "none", undefined, undefined, undefined, undefined);
    else onSetReminder(noteId, next, repeat, before.day, undefined, before.allDay, before.until);
    // Ostatni termin serii: pominięcie ją kończy — komunikat mówi to wprost, nie jak zwykłe pominięcie.
    const undo = () => onSetReminder(noteId, before.reminder, before.repeat, before.day, before.base, before.allDay, before.until);
    if (next === null) toastWithUndo("Seria zakończona", undo, { icon: "🏁", description: "To był ostatni termin serii." });
    else toastWithUndo("Wystąpienie pominięte", undo, { icon: "⏭️" });
    focusDay(new Date(at));
  }

  function handleClear(noteId: string) {
    const before = previousOf(noteId);
    onSetReminder(noteId, null, "none", undefined, undefined, undefined, undefined);
    toastWithUndo("Termin usunięty", () => onSetReminder(noteId, before.reminder, before.repeat, before.day, before.base, before.allDay, before.until), { icon: "🔕" });
    focusDay(selectedDay);
  }

  /** Przeniesienie na inny dzień zachowuje godzinę; seria przesuwa się cała. */
  function moveToDay(occ: Occurrence, day: Date) {
    const from = new Date(occ.at);
    if (isSameDay(from, day)) return;
    // Ta sama godzina może nie istnieć w dniu docelowym (zmiana czasu) — wtedy nie przesuwamy po cichu.
    const clock = `${String(from.getHours()).padStart(2, "0")}:${String(from.getMinutes()).padStart(2, "0")}`;
    const ts = composeReminderTimestamp(day, clock);
    if (ts === null) {
      toast.error("Tej godziny nie ma tego dnia", { description: "Przestawiono zegar (zmiana czasu). Zmień godzinę w edycji." });
      return;
    }
    moveToInstant(occ, new Date(ts));
  }

  /** Przeciągnięcie w pionie na oś tygodnia (K3.6): ten sam dzień i minuta, nowa pełna godzina. */
  function moveToHour(occ: Occurrence, day: Date, hour: number) {
    const from = new Date(occ.at);
    if (isSameDay(from, day) && from.getHours() === hour) return;
    const ts = retimedAt(day, hour, from.getMinutes());
    if (ts === null) {
      toast.error("Tej godziny nie ma tego dnia", { description: "Przestawiono zegar (zmiana czasu). Zmień godzinę w edycji." });
      return;
    }
    moveToInstant(occ, new Date(ts));
  }

  /** Wspólna ścieżka przeniesienia: zapis, przeskok widoku na nowy dzień i cofnięcie w toaście. */
  function moveToInstant(occ: Occurrence, to: Date) {
    const before = previousOf(occ.noteId);
    // Odłożone wystąpienie (`reminder` ≠ `reminderBase`): przesuwamy tylko je, a termin serii zostaje —
    // o ile nowy czas wypada przed następnym terminem serii (ta sama reguła co `snoozeTarget`).
    // Dalej seria liczy się od nowego terminu, jak dotąd.
    const deferred = before.base !== undefined && before.base !== before.reminder;
    const seriesNext = deferred ? nextInSeries(before.base as number, occ.repeat, before.day, before.until) : null;
    const keepSeries = deferred && (seriesNext === null || to.getTime() < seriesNext);
    markMoved(occ.noteId);
    onSetReminder(occ.noteId, to.getTime(), occ.repeat, undefined, keepSeries ? before.base : undefined, occ.allDay, before.until);
    setSelectedDay(to);
    if (!isSameMonth(to, month)) setMonth(new Date(to.getFullYear(), to.getMonth(), 1));
    toastWithUndo(
      `Termin przeniesiony na ${format(to, "d MMMM", { locale: pl })}`,
      () => onSetReminder(occ.noteId, before.reminder, before.repeat, before.day, before.base, before.allDay, before.until),
      { icon: "📅", description: keepSeries ? "Przesunięte tylko to wystąpienie; seria zostaje." : occ.isSeries ? "Cała seria liczy się od nowego terminu." : undefined },
    );
    focusDay(to);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const occ = active.data.current?.occurrence as Occurrence | undefined;
    const day = over?.data.current?.day as Date | undefined;
    if (occ && day) moveToDay(occ, day);
  }

  return { handleAttach, handleSkip, handleClear, moveToDay, moveToHour, handleDragEnd };
}
