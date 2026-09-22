import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Note } from "./useNotes";

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
  onClearReminder: (id: string) => void
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
          fired.add(note.id);
          saveFired(fired);

          // Toast notification
          toast(`⏰ ${note.title || "Przypomnienie"}`, {
            description: note.content ? note.content.slice(0, 80) : "Czas na tę notatkę!",
            duration: 10000,
            action: {
              label: "OK",
              onClick: () => onClearReminder(note.id),
            },
          });

          // Browser notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(note.title || "Dash Notes — Przypomnienie", {
              body: note.content || "Czas na tę notatkę!",
              icon: "/placeholder.svg",
            });
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [notes, onClearReminder]);
}
