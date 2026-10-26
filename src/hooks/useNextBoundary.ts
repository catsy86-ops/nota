import { useEffect, useState } from "react";
import type { Note } from "@/hooks/useNotes";
import { endOfDayOffset, startOfDayOf } from "@/lib/dueTerms";

/** Najdłuższy pojedynczy `setTimeout` (ok. 24,8 dnia). */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Najbliższa chwila, w której grupy Terminów (Zaległe, Dziś, Najbliższe 7 dni…) mogą się zmienić:
 * termin notatki, koniec dnia całodziennego terminu albo północ. `null`, gdy nic przed nami nie ma.
 */
export function nextBoundary(notes: Pick<Note, "reminder" | "reminderAllDay">[], now: number): number | null {
  const midnight = startOfDayOf(now) + 24 * 60 * 60 * 1000;
  let best: number | null = midnight;
  for (const n of notes) {
    if (n.reminder === null) continue;
    const candidates = [n.reminder, n.reminderAllDay === true ? endOfDayOffset(n.reminder) + 1 : n.reminder];
    for (const t of candidates) {
      if (t > now && (best === null || t < best)) best = t;
    }
  }
  return best;
}

/**
 * Zwraca licznik, który rośnie na każdej granicy z `nextBoundary`. Wstaw go w zależności `useMemo`
 * grupującego przypomnienia — wtedy termin przechodzi z „Dziś” do „Zaległe” bez zmiany notatek.
 */
export function useNextBoundary(notes: Pick<Note, "reminder" | "reminderAllDay">[]): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      const now = Date.now();
      const at = nextBoundary(notes, now);
      if (at === null) return;
      id = setTimeout(() => {
        setTick((t) => t + 1);
        arm();
      }, Math.min(Math.max(at - Date.now(), 0) + 5, MAX_TIMEOUT_MS));
    };
    arm();
    return () => clearTimeout(id);
  }, [notes]);

  return tick;
}
