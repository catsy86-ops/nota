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

export const PRIORITY_COLOR_CLASS: Record<NotePriority, string> = {
  none: "",
  low: "text-sky-500",
  medium: "text-amber-500",
  high: "text-rose-500",
};
