import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Note } from "./useNotes";
import { getNextReminderTime } from "@/lib/reminderRepeat";
import { loadFired, saveFired, reconcileFired } from "@/lib/firedReminders";

export function useReminderNotifications(
  notes: Note[],
  onReminderFired: (id: string, nextReminder: number | null) => void
) {
  const firedRef = useRef(loadFired());

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

          toast(`⏰ ${note.title || "Przypomnienie"}`, {
            description: note.content ? note.content.slice(0, 80) : "Czas na tę notatkę!",
            duration: 10000,
            action: {
              label: "OK",
              // For repeating reminders the next occurrence is already
              // scheduled below — OK here should just dismiss the toast.
              onClick: repeat === "none" ? () => onReminderFired(note.id, null) : () => {},
            },
          });

          if ("Notification" in window && Notification.permission === "granted") {
            const title = note.title || "Notatnik — Przypomnienie";
            const options: NotificationOptions = {
              body: note.content || "Czas na tę notatkę!",
              icon: "/pwa-192.png",
              badge: "/pwa-192.png",
              tag: note.id,
              renotify: true,
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
              new Notification(title, options);
            }
          }

          if (repeat !== "none") {
            const next = getNextReminderTime(note.reminder, repeat);
            onReminderFired(note.id, next);
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [notes, onReminderFired]);
}
