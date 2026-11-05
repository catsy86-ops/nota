import type { ChecklistItem } from "@/hooks/useNotes";

/**
 * Przeciągnięcie pozycji listy (nowy plan 5.2): `activeId` ląduje na miejscu `overId`
 * wśród nieodhaczonych. Odhaczone zostają na swoich indeksach w tablicy — przeciągamy
 * tylko otwartą część listy, tak jak Alt+↑/↓. Brak zmiany → ta sama tablica.
 */
export function moveOpenItem(items: ChecklistItem[], activeId: string, overId: string): ChecklistItem[] {
  if (activeId === overId) return items;
  const open = items.filter((i) => !i.checked);
  const from = open.findIndex((i) => i.id === activeId);
  const to = open.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1) return items;
  const reordered = [...open];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  let k = 0;
  return items.map((i) => (i.checked ? i : reordered[k++]));
}
