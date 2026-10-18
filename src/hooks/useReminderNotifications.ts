import { createElement, useEffect, useRef } from "react";
import { ReminderDueToast } from "@/components/ReminderDueToast";
import { snoozeTimes } from "@/lib/reminderAgenda";
import { formatReminderShort } from "@/lib/reminderTime";
import { notePath } from "@/lib/viewRoute";
import { toast } from "sonner";
import type { Note } from "./useNotes";
import { nextInSeries, seriesDay } from "@/lib/reminderRepeat";
import { loadFired, saveFired, reconcileFired } from "@/lib/firedReminders";
import { showSystemNotification } from "@/lib/systemNotification";
import { pushKey } from "@/lib/push/shown";
import { parsePendingAction, withoutActionParam } from "@/lib/notificationAction";

export function useReminderNotifications(
  notes: Note[],
  /** `reminderDay` zostaje z notatki — przesunięcie serii nie zmienia jej dnia. */
  onReminderFired: (id: string, nextReminder: number | null, reminderDay?: number) => void,
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

  // Przyciski akcji z powiadomienia systemowego (public/sw-notifications.js).
  const applyActionRef = useRef((note: Note, action: string) => {
    if (note.locked) return;
    if (action === "snooze10") {
      firedCbRef.current(note.id, snoozeTimes(Date.now()).in10min, seriesDay(note));
      toast("Odłożono o 10 minut");
    } else if (action === "done") {
      firedCbRef.current(note.id, null);
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
      const due = notes.filter((n) => n.reminder && n.reminder <= now && !fired.has(n.id));
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      // Stos kilku dymków u góry zasłaniał nagłówek i treść na każdej trasie — przy ≥ 2 jeden dymek.
      const grouped = due.length >= 2;
      if (grouped) {
        const names = due.slice(0, 3).map((n) => (n.locked ? "Notatka prywatna" : n.title.trim() || "Bez tytułu"));
        const rest = due.length - names.length;
        toast(`${due.length} przypomnienia czekają`, {
          id: "reminders-due",
          description: names.join(" · ") + (rest > 0 ? ` i ${rest} więcej` : ""),
          duration: 30000,
          action: showAllRef.current ? { label: "Zobacz", onClick: () => showAllRef.current?.() } : undefined,
          position: mobile ? "top-center" : undefined,
        });
      }

      for (const note of due) {
        if (note.reminder) {
          const repeat = note.reminderRepeat ?? "none";
          // One-shot reminders are marked fired forever; repeating ones are
          // rescheduled below, so the same id can fire again next cycle.
          if (repeat === "none") {
            fired.add(note.id);
            saveFired(fired);
          }

          const times = snoozeTimes(now);
          const when = formatReminderShort(note.reminder);
          const onDone = () => firedCbRef.current(note.id, null);
          if (!grouped) toast.custom((id) => createElement(ReminderDueToast, {
            toastId: id,
            // Notatka prywatna: ani tytułu, ani treści w dymku (projekcja jest pusta, a tu jawnie nazywamy powód).
            title: note.locked ? "Przypomnienie z notatki prywatnej" : note.title || "Przypomnienie",
            when,
            description: note.locked ? "" : note.content.slice(0, 120),
            canSnooze: repeat === "none",
            // Odłożenie przesuwa termin w przyszłość, więc `reconcileFired`
            // zdejmie wpis „już odpalone” i przypomnienie wystrzeli ponownie.
            onSnooze10: () => firedCbRef.current(note.id, times.in10min, seriesDay(note)),
            onSnoozeTomorrow: () => firedCbRef.current(note.id, times.tomorrow9, seriesDay(note)),
            onDone,
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
          showSystemNotification(note.locked ? "Przypomnienie z notatki prywatnej" : note.title || "Notatnik — Przypomnienie", {
            body: note.locked ? "Otwórz NOTKI i odblokuj skarbiec, aby zobaczyć notatkę." : note.content || "Czas na tę notatkę!",
            tag: note.id,
            key: pushKey.note(note.id, note.reminder),
            url: notePath(note.id),
            requireInteraction: true,
            data: { noteId: note.id },
            actions: [
              ...(repeat === "none" ? [{ action: "snooze10", title: "Odłóż 10 min" }] : []),
              { action: "done", title: "Gotowe" },
            ],
          });

          if (repeat !== "none") {
            const next = nextInSeries(note.reminder, repeat, seriesDay(note), note.reminderRepeatUntil);
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
