import { useEffect, useReducer, useRef } from "react";
import type { Note } from "@/hooks/useNotes";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useDayClock } from "@/lib/dayClock";
import { countOverdue } from "@/lib/reminderAgenda";
import { BASE_TITLE, formatBadgeTitle, useBadgeEnabled } from "@/lib/overdueBadge";

const RECHECK_MS = 30_000;

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Ustawia znaczek aplikacji; brak API albo odmowa systemu nie jest błędem. */
export function applyAppBadge(count: number, nav: BadgeNavigator = navigator): void {
  try {
    const res = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
    res?.catch(() => {});
  } catch {
    // Znaczek to dodatek — nigdy nie wywraca aplikacji.
  }
}

/**
 * Liczba zaległych przypomnień w tytule karty i na ikonie aplikacji.
 * Zwraca tę liczbę, żeby pasek boczny nie liczył jej drugi raz.
 * `notes` to notatki z przypomnieniami poza koszem — archiwum też, bo jego przypomnienia dzwonią (jak w Terminach).
 */
export function useOverdueBadge(notes: Note[]): number {
  const enabled = useBadgeEnabled();
  // Po powrocie do karty i po północy liczymy od razu, bez czekania na odpytanie.
  const tick = useDayClock();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const notesRef = useLatestRef(notes);
  const count = countOverdue(notes);
  const shown = useRef(count);
  shown.current = count;
  // Terminy mijają bez zmiany listy notatek — pilnujemy tego co kilkanaście sekund.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (countOverdue(notesRef.current) !== shown.current) force();
    }, RECHECK_MS);
    return () => window.clearInterval(id);
  }, [notesRef]);

  useEffect(() => {
    if (!enabled) {
      document.title = BASE_TITLE;
      applyAppBadge(0);
      return;
    }
    document.title = formatBadgeTitle(BASE_TITLE, count);
    applyAppBadge(count);
  }, [enabled, count, tick]);

  useEffect(() => () => {
    document.title = BASE_TITLE;
    applyAppBadge(0);
  }, []);

  return count;
}
