import type { ChecklistItem } from "@/hooks/useNotes";

/** Znaczniki list z Markdown/Keepa/Worda zdejmowane z początku linii. */
const TASK_RE = /^[-*+•]?\s*\[([ xX])\]\s+/;
const BULLET_RE = /^(?:[-*+•▪◦]|\d{1,3}[.)])\s+/;

/** Każda niepusta linia to jedna pozycja; znaczniki list zdejmowane, `- [x] coś` odhaczone. */
export function parseChecklistLines(text: string): Omit<ChecklistItem, "id">[] {
  const out: Omit<ChecklistItem, "id">[] = text.split(/\r?\n/).filter((l) => l.trim()).map((raw) => {
    // Wcięta linia (2+ spacje albo tabulator) to podzadanie poprzedniej pozycji.
    const indented = /^(?: {2,}|\t)/.test(raw);
    const line = raw.trim();
    const task = TASK_RE.exec(line);
    const item = task
      ? { text: line.slice(task[0].length).trim(), checked: task[1] !== " " }
      : { text: line.replace(BULLET_RE, "").trim(), checked: false };
    return indented ? { ...item, indent: 1 as const } : item;
  }).filter((i) => i.text);
  // Pierwsza pozycja nie ma nad czym się wcinać.
  if (out[0]?.indent) delete out[0].indent;
  return out;
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
  const lines = checklist.map((i) => `${i.indent ? "  " : ""}- [${i.checked ? "x" : " "}] ${i.text}`).join("\n");
  const base = content.replace(/\s+$/, "");
  return { content: base && lines ? `${base}\n${lines}` : base || lines, checklist: [] as ChecklistItem[] };
}

/**
 * Skrót Ctrl+Shift+L: linie objęte zaznaczeniem (albo bieżąca linia, gdy brak zaznaczenia)
 * trafiają jako pozycje na koniec listy i znikają z treści. `null`, gdy nie ma nic do zamiany.
 */
export function selectionToChecklist(
  content: string,
  selStart: number,
  selEnd: number,
  checklist: ChecklistItem[],
  makeId: () => string = () => crypto.randomUUID(),
) {
  const lo = Math.max(0, Math.min(selStart, selEnd));
  let hi = Math.min(content.length, Math.max(selStart, selEnd));
  const NL = String.fromCharCode(10);
  // Zaznaczenie kończące się tuż po znaku nowej linii nie obejmuje następnej linii.
  if (hi > lo && content[hi - 1] === NL) hi--;
  const from = lo === 0 ? 0 : content.lastIndexOf(NL, lo - 1) + 1;
  const nl = content.indexOf(NL, hi);
  const to = nl === -1 ? content.length : nl;
  const added = parseChecklistLines(content.slice(from, to)).map((i) => ({ ...i, id: makeId() }));
  if (added.length === 0) return null;
  const after = content.slice(to);
  // Sklejamy sąsiednie linie bez pustej dziury po wyciętym fragmencie.
  let before = content.slice(0, from);
  // Wyciętym końcem tekstu nie zostawiamy osieroconego znaku nowej linii.
  if (!after && before.endsWith(NL)) before = before.slice(0, -1);
  return { content: before + (after.startsWith(NL) ? after.slice(1) : after), checklist: [...checklist, ...added], cursor: from };
}

/** Ctrl/Cmd + Shift + L. */
export function isChecklistShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "l";
}
