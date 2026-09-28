import type { ChecklistItem } from "@/hooks/useNotes";

// Znacznik listy na początku linii: "- ", "* ", "+ ", "1. ", opcjonalnie z "[ ]" / "[x]".
const MARKER = /^\s*(?:(?:[-*+•]|\d+[.)])\s+)?(?:\[([ xX])\]\s*)?/;

/** Linie tekstu → pozycje listy. Puste linie pomijane, znaczniki zdejmowane, "[x]" odhacza. */
export function linesToChecklistItems(text: string, makeId: () => string = () => crypto.randomUUID()): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(MARKER);
    const body = raw.slice(m ? m[0].length : 0).trim();
    if (!body) continue;
    items.push({ id: makeId(), text: body, checked: !!m?.[1] && m[1] !== " " });
  }
  return items;
}

/** Pozycje listy → linie Markdown "- [ ] tekst" / "- [x] tekst". */
export function checklistItemsToText(items: ChecklistItem[]): string {
  return items.map((i) => `- [${i.checked ? "x" : " "}] ${i.text}`).join("\n");
}

/** „Zamień na listę”: treść dopisana jako pozycje za istniejącymi, treść pusta. */
export function contentToChecklist(content: string, checklist: ChecklistItem[], makeId?: () => string) {
  return { content: "", checklist: [...checklist, ...linesToChecklistItems(content, makeId)] };
}

/** „Zamień na tekst”: pozycje dopisane jako linie pod treścią, lista pusta. */
export function checklistToContent(content: string, checklist: ChecklistItem[]) {
  const lines = checklistItemsToText(checklist);
  const base = content.replace(/\s+$/, "");
  return { content: base && lines ? `${base}\n${lines}` : base || lines, checklist: [] as ChecklistItem[] };
}
