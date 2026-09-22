import Fuse from "fuse.js";
import type { Note } from "@/hooks/useNotes";

/**
 * Fuzzy search with simple operators: `label:Foo`, `color:peach`, `has:reminder`, `has:checklist`.
 * Free-text portion is matched fuzzily against title/content/labels.
 */
export function searchNotes(notes: Note[], query: string): Note[] {
  const q = query.trim();
  if (!q) return notes;

  const operators: { label: string[]; color: string[]; has: string[] } = { label: [], color: [], has: [] };
  const freeParts: string[] = [];

  for (const tok of q.split(/\s+/)) {
    const m = tok.match(/^(label|color|has):(.+)$/i);
    if (m) {
      const key = m[1].toLowerCase() as keyof typeof operators;
      operators[key].push(m[2].toLowerCase());
    } else {
      freeParts.push(tok);
    }
  }

  let pool = notes;
  if (operators.label.length) {
    pool = pool.filter((n) => operators.label.every((l) => n.labels.some((nl) => nl.toLowerCase() === l)));
  }
  if (operators.color.length) {
    pool = pool.filter((n) => operators.color.includes(n.color.toLowerCase()));
  }
  if (operators.has.length) {
    pool = pool.filter((n) =>
      operators.has.every((h) =>
        h === "reminder" ? !!n.reminder :
        h === "checklist" ? (n.checklist || []).length > 0 :
        h === "image" || h === "images" ? (n.images || []).length > 0 :
        true
      )
    );
  }

  const free = freeParts.join(" ").trim();
  if (!free) return pool;

  const fuse = new Fuse(pool, {
    keys: [
      { name: "title", weight: 0.5 },
      { name: "content", weight: 0.3 },
      { name: "labels", weight: 0.2 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: false,
  });
  return fuse.search(free).map((r) => r.item);
}
