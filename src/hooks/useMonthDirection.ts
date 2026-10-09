import { useState } from "react";

export type MonthDirection = -1 | 0 | 1;

/**
 * Kierunek ostatniej zmiany miesiąca: 1 = dalej, -1 = wstecz, 0 = pierwszy
 * render. Siatki miesiąca wjeżdżają z tej strony, w którą idzie nawigacja.
 * Poprzedni miesiąc trzymamy w stanie (wzorzec „stan z poprzedniego renderu”),
 * nie w refie — render zostaje czysty.
 */
export function useMonthDirection(month: Date): MonthDirection {
  const index = month.getFullYear() * 12 + month.getMonth();
  const [last, setLast] = useState({ index, dir: 0 as MonthDirection });
  if (last.index === index) return last.dir;
  const dir: MonthDirection = index > last.index ? 1 : -1;
  setLast({ index, dir });
  return dir;
}

/** Klasa wejścia siatki po zmianie miesiąca (keyframes w index.css). */
export function monthEnterClass(dir: MonthDirection): string | undefined {
  return dir > 0 ? "month-in-next" : dir < 0 ? "month-in-prev" : undefined;
}
