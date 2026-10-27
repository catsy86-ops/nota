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

/**
 * Po starcie, gdy przeglądarka ma wolną chwilę, pobiera paczki wszystkich leniwych działów
 * (plan UI/UX 4.1): klik w dział nie czeka na sieć. Paczki startowej to nie zmienia.
 * Przy trybie oszczędzania danych (`saveData`) nic nie pobiera — zostaje ładowanie na najechanie.
 */
export function prefetchViewsWhenIdle(): void {
  if (typeof window === "undefined") return;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (saveData) return;
  const run = () => {
    (Object.keys(loaders) as LazyView[]).forEach((view) => preloadView(view));
  };
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 5000 });
  else window.setTimeout(run, 2000);
}
