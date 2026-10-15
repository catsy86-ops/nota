import type { View } from "@/hooks/useFilteredNotes";

// Widoki ładowane leniwie (osobne paczki). Te same obietnice służą `lazy()`
// w Index.tsx i wstępnemu ładowaniu z nawigacji — import modułu jest
// zapamiętywany, więc paczka pobiera się raz, niezależnie od kolejności.
const loaders = {
  calendar: () => import("@/components/calendar/ReminderCalendarView"),
  shifts: () => import("@/components/shifts/ShiftsView"),
  study: () => import("@/components/study/StudyView"),
} as const;

export type LazyView = keyof typeof loaders;

const started = new Map<LazyView, Promise<unknown>>();

function load<V extends LazyView>(view: V): ReturnType<(typeof loaders)[V]> {
  let p = started.get(view);
  if (!p) {
    p = loaders[view]();
    // Nieudane pobranie (np. brak sieci) nie zostaje w pamięci — następna próba pobiera od nowa.
    p.catch(() => started.delete(view));
    started.set(view, p);
  }
  return p as ReturnType<(typeof loaders)[V]>;
}

export const loadCalendarView = () => load("calendar");
export const loadShiftsView = () => load("shifts");
export const loadStudyView = () => load("study");

export function isLazyView(view: View): view is LazyView {
  return view in loaders;
}

/** Zaczyna pobierać paczkę widoku, zanim użytkownik puści palec / przycisk. Błędy połyka — `lazy()` spróbuje jeszcze raz. */
export function preloadView(view: View): void {
  if (isLazyView(view)) load(view).catch(() => {});
}
