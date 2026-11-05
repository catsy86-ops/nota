import type { ChecklistItem, Note } from "@/hooks/useNotes";

/** Jedna nieodhaczona pozycja listy do odhaczenia prosto z Dziś (Dziś 4.2). */
export interface TodayListRow {
  noteId: string;
  noteTitle: string;
  item: ChecklistItem;
}

const sameDay = (a: number, b: Date) => {
  const d = new Date(a);
  return d.getFullYear() === b.getFullYear() && d.getMonth() === b.getMonth() && d.getDate() === b.getDate();
};

/**
 * Pozycje list „na dziś”: z notatek zmienionych dziś albo z terminem dziś, tylko nieodhaczone.
 * Bez notatek prywatnych (projekcja jest pusta), z archiwum i z kosza. Najwyżej `limit` wierszy —
 * reszta jest w notatkach; `more` mówi, ile się nie zmieściło.
 */
export function todayListRows(notes: readonly Note[], now: Date, limit = 8): { rows: TodayListRow[]; more: number } {
  const all: TodayListRow[] = [];
  for (const n of notes) {
    if (n.locked || n.trashed || n.archived || !n.checklist?.length) continue;
    const today = sameDay(n.updatedAt, now) || (n.reminder !== null && sameDay(n.reminder, now));
    if (!today) continue;
    const title = n.title.trim() || "Lista bez tytułu";
    for (const item of n.checklist) if (!item.checked && item.text.trim()) all.push({ noteId: n.id, noteTitle: title, item });
  }
  return { rows: all.slice(0, limit), more: Math.max(0, all.length - limit) };
}

/** Lista notatki z jedną pozycją odhaczoną — reszta bez zmian. */
export function checkItem(checklist: readonly ChecklistItem[], itemId: string): ChecklistItem[] {
  return checklist.map((i) => (i.id === itemId ? { ...i, checked: true } : i));
}
