import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Note } from "./useNotes";
import { getNextReminderTime } from "@/lib/reminderRepeat";

const FIRED_KEY = "dash-notes-fired-reminders";

function getFired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveFired(set: Set<string>) {
  localStorage.setItem(FIRED_KEY, JSON.stringify([...set]));
}

export function useReminderNotifications(
  notes: Note[],
  onReminderFired: (id: string, nextReminder: number | null) => void
) {
  const firedRef = useRef(getFired());

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    function check() {
      const now = Date.now();
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
            new Notification(note.title || "Dash Notes — Przypomnienie", {
              body: note.content || "Czas na tę notatkę!",
              icon: "/placeholder.svg",
            });
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
