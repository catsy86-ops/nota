export type NotePriority = "none" | "low" | "medium" | "high";

export const PRIORITY_LABELS: Record<NotePriority, string> = {
  none: "Brak",
  low: "Niski",
  medium: "Średni",
  high: "Wysoki",
};

/** Kolejność do sortowania — wyższy priorytet pierwszy przy malejącym sortowaniu. */
export const PRIORITY_ORDER: Record<NotePriority, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Kolor ikony priorytetu: ciemniejszy na jasnym tle (≥4.5:1), jaśniejszy w ciemnym motywie. */
export const PRIORITY_COLOR_CLASS: Record<NotePriority, string> = {
  none: "",
  low: "text-sky-700 dark:text-sky-400",
  medium: "text-amber-700 dark:text-amber-400",
  high: "text-rose-700 dark:text-rose-400",
};
