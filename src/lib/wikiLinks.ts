import type { Note } from "@/hooks/useNotes";

const RX = /\[\[([^[\]\n]+?)\]\]/g;

/** Extract note titles referenced via [[Title]] syntax. */
export function extractWikiLinks(content: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RX.exec(content)) !== null) {
    const t = m[1].trim();
    if (t) out.add(t.toLowerCase());
  }
  return Array.from(out);
}

/** Notes that mention this note's title via [[…]]. */
export function findBacklinks(note: Note, all: Note[]): Note[] {
  const title = note.title.trim().toLowerCase();
  if (!title) return [];
  return all.filter(
    (n) => n.id !== note.id && extractWikiLinks(n.content).includes(title)
  );
}

/** Resolve a wiki target title → note id (case-insensitive). */
export function resolveWikiTarget(title: string, all: Note[]): Note | undefined {
  const t = title.trim().toLowerCase();
  return all.find((n) => n.title.trim().toLowerCase() === t);
}
