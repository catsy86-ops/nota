import { createElement, useEffect, useRef } from "react";
import { ReminderDueToast } from "@/components/ReminderDueToast";
import { snoozeTimes } from "@/lib/reminderAgenda";
import { formatReminderShort } from "@/lib/reminderTime";
import { notePath } from "@/lib/viewRoute";
import { toast } from "sonner";
import type { Note } from "./useNotes";
import { nextInSeries, seriesDay } from "@/lib/reminderRepeat";
import { loadFired, saveFired, reconcileFired } from "@/lib/firedReminders";

export function useReminderNotifications(
  notes: Note[],
  /** `reminderDay` zostaje z notatki — przesunięcie serii nie zmienia jej dnia. */
  onReminderFired: (id: string, nextReminder: number | null, reminderDay?: number) => void,
  onOpen?: (id: string) => void,
  /** Ostatni termin serii właśnie wystrzelił — seria staje się jednorazowa. */
  onSeriesEnded?: (id: string) => void,
) {
  const firedRef = useRef(loadFired());
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  useEffect(() => {
    function check() {
      const now = Date.now();

      // Wpis „już odpalone” ma sens tylko dopóki termin jest w przeszłości.
      // Przesunięcie go w przyszłość (edycja, przeciągnięcie w kalendarzu)
      // musi pozwolić przypomnieniu wystrzelić ponownie.
      const { next, changed } = reconcileFired(firedRef.current, notes, now);
      if (changed) {
        firedRef.current = next;
        saveFired(next);
      }
      const fired = firedRef.current;

      for (const note of notes) {
        if (note.reminder && note.reminder <= now && !fired.has(note.id)) {
          const repeat = note.reminderRepeat ?? "none";
          // One-shot reminders are marked fired forever; repeating ones are
          // rescheduled below, so the same id can fire again next cycle.
          if (repeat === "none") {
            fired.add(note.id);
            saveFired(fired);
          }

          const times = snoozeTimes(now);
          const when = formatReminderShort(note.reminder);
          const onDone = () => onReminderFired(note.id, null);
          toast.custom((id) => createElement(ReminderDueToast, {
            toastId: id,
            title: note.title || "Przypomnienie",
            when,
            description: note.content.slice(0, 120),
            canSnooze: repeat === "none",
            // Odłożenie przesuwa termin w przyszłość, więc `reconcileFired`
            // zdejmie wpis „już odpalone” i przypomnienie wystrzeli ponownie.
            onSnooze10: () => onReminderFired(note.id, times.in10min, seriesDay(note)),
            onSnoozeTomorrow: () => onReminderFired(note.id, times.tomorrow9, seriesDay(note)),
            onDone,
            onOpen: () => onOpenRef.current?.(note.id),
          }), {
            duration: 30000,
            // Telefon: u góry, jak powiadomienia systemu — na dole zasłaniało
            // „Zapisz” w edytorze, dolną nawigację i bywało pod klawiaturą.
            position: window.matchMedia("(max-width: 767px)").matches ? "top-center" : undefined,
          });

          if ("Notification" in window && Notification.permission === "granted") {
            const title = note.title || "Notatnik — Przypomnienie";
            const options: NotificationOptions = {
              body: note.content || "Czas na tę notatkę!",
              icon: "/pwa-192.png",
              badge: "/pwa-192.png",
              tag: note.id,
              renotify: true,
              // Klik otwiera tę notatkę (public/sw-notifications.js).
              data: { url: notePath(note.id) },
            };
            // Wyświetlenie samego powiadomienia idzie przez rejestrację SW
            // (spójniejsze na Androidzie niż gołe `new Notification()`), ale
            // to nie znaczy, że działa w tle: `check()` niżej to zwykły
            // setInterval w JS strony — jeśli karta/appka jest zamknięta,
            // nic go nie odpala, więc przypomnienie i tak nie wystrzeli o
            // czasie (dogoni je dopiero `<= now` przy następnym otwarciu).
            // Prawdziwe powiadomienia w tle wymagałyby Web Push + serwera.
            if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready
                .then((registration) => registration.showNotification(title, options))
                .catch(() => new Notification(title, options));
            } else {
              const n = new Notification(title, options);
              n.onclick = () => { window.focus(); window.location.assign(notePath(note.id)); };
            }
          }

          if (repeat !== "none") {
            const next = nextInSeries(note.reminder, repeat, seriesDay(note), note.reminderRepeatUntil);
            if (next !== null) onReminderFired(note.id, next, seriesDay(note));
            else {
              // Ostatni termin: zostaje jak odpalone jednorazowe przypomnienie.
              fired.add(note.id);
              saveFired(fired);
              onSeriesEnded?.(note.id);
            }
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [notes, onReminderFired, onSeriesEnded]);
}
