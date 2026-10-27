import { createElement, useEffect, useRef } from "react";
import { ReminderDueToast } from "@/components/ReminderDueToast";
import { eveningTime, snoozeTimes } from "@/lib/reminderAgenda";
import { reminderFields } from "@/lib/reminderActions";
import { toastWithUndo } from "@/lib/undoToast";
import { doneTarget, snoozeTarget } from "@/lib/reminderRepeat";
import { formatReminderShort } from "@/lib/reminderTime";
import { notePath } from "@/lib/viewRoute";
import { toast } from "sonner";
import type { Note } from "./useNotes";
import { seriesDay } from "@/lib/reminderRepeat";
import { planDueReminders } from "@/lib/reminderDue";
import { loadFired, saveFired, reconcileFired } from "@/lib/firedReminders";
import { showSystemNotification } from "@/lib/systemNotification";
import { pushKey } from "@/lib/push/shown";
import { parsePendingAction, withoutActionParam } from "@/lib/notificationAction";

/**
 * „Gotowe” na przypomnieniu. Seria przechodzi do następnego wystąpienia (`doneTarget`); koniec serii
 * albo zwykłe przypomnienie zapisuje `null`. Nowy termin serii czyści odłożenie (brak `reminderBase`).
 */
function markDone(
  note: Note,
  now: number,
  fire: (id: string, nextReminder: number | null, reminderDay?: number, reminderBase?: number) => void,
) {
  const next = doneTarget(note, now);
  if (next === null) fire(note.id, null);
  else fire(note.id, next, seriesDay(note), undefined);
}

export function useReminderNotifications(
  notes: Note[],
  /**
   * `reminderDay` zostaje z notatki — przesunięcie serii nie zmienia jej dnia. `reminderBase` — termin serii,
   * gdy odkładamy jedno wystąpienie (`snoozeTarget`); bez niego zapis to zwykły termin.
   */
  onReminderFired: (id: string, nextReminder: number | null, reminderDay?: number, reminderBase?: number) => void,
  onOpen?: (id: string) => void,
  /** Ostatni termin serii właśnie wystrzelił — seria staje się jednorazowa. */
  onSeriesEnded?: (id: string) => void,
  /** Notatki z kosza: nie odpalają, ale ich wpis „już odpalone” ma przetrwać do przywrócenia. */
  trashed: Note[] = [],
  /** Kilka terminów naraz (np. po otwarciu aplikacji): jeden zbiorczy dymek z „Zobacz” zamiast stosu. */
  onShowAll?: () => void,
) {
  const showAllRef = useRef(onShowAll);
  showAllRef.current = onShowAll;
  const firedRef = useRef(loadFired());
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const firedCbRef = useRef(onReminderFired);
  firedCbRef.current = onReminderFired;
  const seriesEndedRef = useRef(onSeriesEnded);
  seriesEndedRef.current = onSeriesEnded;
  const trashedRef = useRef(trashed);
  trashedRef.current = trashed;
  // id → termin już obsłużony (`planDueReminders`), żeby opóźniony zapis nie odpalił go drugi raz.
  const handledRef = useRef(new Map<string, number>());

  // Przyciski akcji z powiadomienia systemowego (public/sw-notifications.js).
  // T 1.5: odłożenie i „Gotowe” działają też na prywatnej notatce — zmieniają tylko pola terminu
  // (jawna projekcja), więc skarbiec nie musi być odblokowany. Treści nie czytamy ani nie zapisujemy.
  const applyActionRef = useRef((note: Note, action: string) => {
    if (action === "snooze10") {
      const now = Date.now();
      const t = snoozeTarget(note, snoozeTimes(now).in10min, now);
      firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase);
      toast("Odłożono o 10 minut");
    } else if (action === "done") {
      markDone(note, Date.now(), firedCbRef.current);
      toast("Przypomnienie odhaczone");
    }
  });
  useEffect(() => {
    const sw = typeof navigator !== "undefined" ? navigator.serviceWorker : undefined;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; action?: string; noteId?: string } | null;
      if (d?.type !== "notification-action" || typeof d.noteId !== "string") return;
      const note = notesRef.current.find((n) => n.id === d.noteId);
      if (note && d.action) applyActionRef.current(note, d.action);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  // Akcja z powiadomienia przy zamkniętej aplikacji: worker otworzył `/notatka/<id>?akcja=…`.
  // Notatki wczytują się z IndexedDB chwilę po starcie — wykonujemy akcję, gdy notatka się pojawi.
  const pendingActionRef = useRef(typeof window !== "undefined" ? parsePendingAction(window.location.pathname, window.location.search) : null);
  useEffect(() => {
    const pending = pendingActionRef.current;
    if (!pending) return;
    const note = notes.find((n) => n.id === pending.noteId);
    if (!note) return;
    pendingActionRef.current = null;
    history.replaceState(history.state, "", window.location.pathname + withoutActionParam(window.location.search) + window.location.hash);
    applyActionRef.current(note, pending.action);
  }, [notes]);

  useEffect(() => {
    function check() {
      const now = Date.now();

      // Wpis „już odpalone” ma sens tylko dopóki termin jest w przeszłości.
      // Przesunięcie go w przyszłość (edycja, przeciągnięcie w kalendarzu)
      // musi pozwolić przypomnieniu wystrzelić ponownie.
      const { next, changed } = reconcileFired(firedRef.current, [...notes, ...trashedRef.current], now);
      if (changed) {
        firedRef.current = next;
        saveFired(next);
      }
      const fired = firedRef.current;
      // Decyzja, co odpalić, jest w `planDueReminders` (czysta, testowana): seria zaległa o kilka cykli
      // daje jeden krok z liczbą pominiętych wystąpień, a nie stos dymków.
      // Wpis „obsłużone” żyje tylko, dopóki notatka ma stary termin; po zmianie terminu albo usunięciu notatki znika.
      for (const [id, obsluzony] of handledRef.current) {
        if (!notes.some((n) => n.id === id && n.reminder === obsluzony)) handledRef.current.delete(id);
      }
      const steps = planDueReminders(notes, fired, now, handledRef.current);
      const due = steps.map((s) => s.note);
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      // Stos kilku dymków u góry zasłaniał nagłówek i treść na każdej trasie — przy ≥ 2 jeden dymek.
      const grouped = due.length >= 2;
      if (grouped) {
        const names = due.slice(0, 3).map((n) => (n.locked ? "Notatka prywatna" : n.title.trim() || "Bez tytułu"));
        const rest = due.length - names.length;
        // T 2.3: „Odłóż wszystkie o godzinę” odkłada każde wystąpienie jednym kliknięciem; „Cofnij” w toaście
        // przywraca wszystkie naraz. „Zobacz” zostaje jako drugi przycisk dymku.
        const snapshot = due.map((n) => ({ note: n, prev: reminderFields(n) }));
        toast(`${due.length} przypomnienia czekają`, {
          id: "reminders-due",
          description: names.join(" · ") + (rest > 0 ? ` i ${rest} więcej` : ""),
          duration: 30000,
          action: {
            label: "Odłóż wszystkie o godzinę",
            onClick: () => {
              const now = Date.now();
              const at = snoozeTimes(now).inHour;
              for (const { note } of snapshot) {
                const t = snoozeTarget(note, at, now);
                firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase);
              }
              toastWithUndo(`Odłożono ${snapshot.length} o godzinę`, () => {
                for (const { note, prev } of snapshot) firedCbRef.current(note.id, prev.reminder, prev.reminderDay, prev.reminderBase);
              }, { id: "reminders-due-snooze" });
            },
          },
          cancel: showAllRef.current ? { label: "Zobacz", onClick: () => showAllRef.current?.() } : undefined,
          position: mobile ? "top-center" : undefined,
        });
      }

      for (const { note, kind, next, missed } of steps) {
        if (note.reminder) {
          // Ten termin jest obsłużony: zapis przesunięcia może jeszcze nie dotrzeć do listy notatek.
          handledRef.current.set(note.id, note.reminder);
          // One-shot reminders are marked fired forever; repeating ones are
          // rescheduled below, so the same id can fire again next cycle.
          if (kind === "once") {
            fired.add(note.id);
            saveFired(fired);
          }

          const times = snoozeTimes(now);
          const evening = eveningTime(now);
          const when = missed > 0 ? `${formatReminderShort(note.reminder)} · pominięto ${missed}` : formatReminderShort(note.reminder);
          if (!grouped) toast.custom((id) => createElement(ReminderDueToast, {
            toastId: id,
            // Notatka prywatna: ani tytułu, ani treści w dymku (projekcja jest pusta, a tu jawnie nazywamy powód).
            title: note.locked ? "Przypomnienie z notatki prywatnej" : note.title || "Przypomnienie",
            when,
            description: note.locked ? "" : note.content.slice(0, 120),
            // Odłożenie przesuwa termin w przyszłość, więc `reconcileFired`
            // zdejmie wpis „już odpalone” i przypomnienie wystrzeli ponownie.
            // Seria: odkładamy tylko to wystąpienie (`snoozeTarget`), reszta serii zostaje.
            onSnooze10: () => { const t = snoozeTarget(note, times.in10min, now); firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase); },
            onSnoozeTomorrow: () => { const t = snoozeTarget(note, times.tomorrow9, now); firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase); },
            onSnoozeHour: () => { const t = snoozeTarget(note, times.inHour, now); firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase); },
            onSnoozeEvening: evening === null ? undefined : () => { const t = snoozeTarget(note, evening, now); firedCbRef.current(note.id, t.reminder, seriesDay(note), t.reminderBase); },
            onDone: () => markDone(note, Date.now(), firedCbRef.current),
            onOpen: () => onOpenRef.current?.(note.id),
          }), {
            duration: 30000,
            // Telefon: u góry, jak powiadomienia systemu — na dole zasłaniało
            // „Zapisz” w edytorze, dolną nawigację i bywało pod klawiaturą.
            position: mobile ? "top-center" : undefined,
          });

          // Przyciski w powiadomieniu działają przez SW → wiadomość do otwartej karty (niżej).
          // Przy zamkniętej aplikacji termin wysyła serwer push (`lib/push/`), jeśli jest włączony —
          // klucz `pushKey.note` nie pozwala pokazać go tu drugi raz.
          showSystemNotification(note.locked ? "Przypomnienie z notatki prywatnej" : note.title || "NOTKI — Przypomnienie", {
            body: note.locked ? "Otwórz G i odblokuj skarbiec, aby zobaczyć notatkę." : note.content || "Czas na tę notatkę!",
            tag: note.id,
            key: pushKey.note(note.id, note.reminder),
            url: notePath(note.id),
            requireInteraction: true,
            data: { noteId: note.id },
            actions: [
              { action: "snooze10", title: "Odłóż 10 min" },
              { action: "done", title: "Gotowe" },
            ],
          });

          if (kind === "series") {
            if (next !== null) firedCbRef.current(note.id, next, seriesDay(note));
            else {
              // Ostatni termin: zostaje jak odpalone jednorazowe przypomnienie.
              fired.add(note.id);
              saveFired(fired);
              seriesEndedRef.current?.(note.id);
            }
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [notes]);
}
