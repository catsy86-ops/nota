import type { ChecklistItem } from "@/hooks/useNotes";

/** Znaczniki list z Markdown/Keepa/Worda zdejmowane z początku linii. */
const TASK_RE = /^[-*+•]?\s*\[([ xX])\]\s+/;
const BULLET_RE = /^(?:[-*+•▪◦]|\d{1,3}[.)])\s+/;

/** Każda niepusta linia to jedna pozycja; znaczniki list zdejmowane, `- [x] coś` odhaczone. */
export function parseChecklistLines(text: string): Omit<ChecklistItem, "id">[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const task = TASK_RE.exec(line);
    if (task) return { text: line.slice(task[0].length).trim(), checked: task[1] !== " " };
    return { text: line.replace(BULLET_RE, "").trim(), checked: false };
  }).filter((i) => i.text);
}

/**
 * Dzieli wklejony tekst na pozycje listy. Tekst jednoliniowy zwraca `null` —
 * wtedy przeglądarka wkleja go zwyczajnie.
 */
export function parsePastedChecklist(text: string): Omit<ChecklistItem, "id">[] | null {
  if (text.split(/\r?\n/).filter((l) => l.trim()).length < 2) return null;
  return parseChecklistLines(text);
}

/** „Zamień na listę”: linie treści dopisane jako pozycje za istniejącymi, treść pusta. */
export function contentToChecklist(content: string, checklist: ChecklistItem[], makeId: () => string = () => crypto.randomUUID()) {
  const added = parseChecklistLines(content).map((i) => ({ ...i, id: makeId() }));
  return { content: "", checklist: [...checklist, ...added] };
}

/** „Zamień na tekst”: pozycje jako `- [ ] tekst` / `- [x] tekst` pod treścią, lista pusta. */
export function checklistToContent(content: string, checklist: ChecklistItem[]) {
  const lines = checklist.map((i) => `- [${i.checked ? "x" : " "}] ${i.text}`).join("\n");
  const base = content.replace(/\s+$/, "");
  return { content: base && lines ? `${base}\n${lines}` : base || lines, checklist: [] as ChecklistItem[] };
}
