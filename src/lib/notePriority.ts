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

/** Kolor ikony priorytetu z tokenów stylu (W6.3): kontrast pilnowany w każdym stylu i schemacie, bez `dark:`.
 *  Niski jest wyciszony, średni i wysoki biorą barwy ostrzeżenia i błędu. */
export const PRIORITY_COLOR_CLASS: Record<NotePriority, string> = {
  none: "",
  low: "text-muted-foreground",
  medium: "text-warning-ink",
  high: "text-destructive-ink",
};
