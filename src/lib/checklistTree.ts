import type { ChecklistItem } from "@/hooks/useNotes";

/**
 * Podzadania listy (plan Notatek 2.2): podzadanie to pozycja z `indent: 1` stojąca zaraz pod pozycją główną.
 * Dzieci rodzica to kolejne wcięte pozycje za nim w tablicy, aż do następnej pozycji głównej.
 */
export function childIds(items: readonly ChecklistItem[], id: string): string[] {
  const at = items.findIndex((i) => i.id === id);
  if (at === -1 || items[at].indent === 1) return [];
  const out: string[] = [];
  for (let k = at + 1; k < items.length && items[k].indent === 1; k++) out.push(items[k].id);
  return out;
}

/**
 * Odhaczenie pozycji. Odhaczenie rodzica odhacza też jego nieukończone podzadania (`cascaded` = ile ich było);
 * cofnięcie odhaczenia rodzica zostawia podzadania bez zmian, a podzadanie odhacza się samo.
 */
export function toggleChecklistItem(items: readonly ChecklistItem[], id: string): { items: ChecklistItem[]; cascaded: number } {
  const item = items.find((i) => i.id === id);
  if (!item) return { items: [...items], cascaded: 0 };
  const checking = !item.checked;
  const kids = checking ? new Set(childIds(items, id).filter((c) => !items.find((i) => i.id === c)?.checked)) : new Set<string>();
  return {
    items: items.map((i) => (i.id === id ? { ...i, checked: checking } : kids.has(i.id) ? { ...i, checked: true } : i)),
    cascaded: kids.size,
  };
}
