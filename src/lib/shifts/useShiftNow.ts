import { useEffect, useMemo, useState } from "react";
import { currentAndNextShift, recentlyEndedShift, type ShiftData, type ShiftOccurrence } from "./index";

/** Minutowy zegar — karta ma pokazywać „za 3 h”, nie stan sprzed godziny. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface ShiftNow {
  now: Date;
  /** Zmiana trwająca teraz. */
  current: ShiftOccurrence | null;
  /** Najbliższa następna zmiana (horyzont w `currentAndNextShift`). */
  next: ShiftOccurrence | null;
  /** Zmiana skończona przed chwilą (nadgodziny), gdy nic nie trwa. */
  ended: ShiftOccurrence | null;
}

/**
 * Bieżąca / następna / zakończona zmiana z minutowym zegarem. Wspólne dla karty „Teraz”
 * w Grafiku, a później Dziś i widżetu, żeby wszystkie liczyły zmiany tak samo.
 */
export function useShiftNow(data: ShiftData, intervalMs = 60_000): ShiftNow {
  const now = useNow(intervalMs);
  const { current, next } = useMemo(() => currentAndNextShift(data, now), [data, now]);
  const ended = useMemo(() => (current ? null : recentlyEndedShift(data, now)), [data, now, current]);
  return { now, current, next, ended };
}
