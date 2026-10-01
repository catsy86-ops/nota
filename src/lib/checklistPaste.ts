import type { ChecklistItem } from "@/hooks/useNotes";

/** Znaczniki list z Markdown/Keepa/Worda zdejmowane z początku linii. */
const TASK_RE = /^[-*+•]?\s*\[([ xX])\]\s+/;
const BULLET_RE = /^(?:[-*+•▪◦]|\d{1,3}[.)])\s+/;

/**
 * Dzieli wklejony tekst na pozycje listy: każda niepusta linia to jedna pozycja.
 * `- [x] coś` trafia jako odhaczone. Tekst jednoliniowy zwraca `null` —
 * wtedy przeglądarka wkleja go zwyczajnie.
 */
export function parsePastedChecklist(text: string): Omit<ChecklistItem, "id">[] | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  return lines.map((line) => {
    const task = TASK_RE.exec(line);
    if (task) return { text: line.slice(task[0].length).trim(), checked: task[1] !== " " };
    return { text: line.replace(BULLET_RE, "").trim(), checked: false };
  }).filter((i) => i.text);
}
