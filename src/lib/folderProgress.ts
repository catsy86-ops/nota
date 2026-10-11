import type { Folder, Note } from "@/hooks/useNotes";

export interface Progress { done: number; total: number }

const TASK_LINE = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s/;

/** Pozycje zadań notatki: lista kontrolna + pola `- [ ]` w treści (poza blokami kodu). */
export function noteProgress(note: Pick<Note, "content" | "checklist" | "locked">): Progress {
  if (note.locked) return { done: 0, total: 0 };
  let done = 0;
  let total = 0;
  for (const c of note.checklist ?? []) {
    total++;
    if (c.checked) done++;
  }
  let fenced = false;
  for (const line of note.content.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = TASK_LINE.exec(line);
    if (!m) continue;
    total++;
    if (m[1] !== " ") done++;
  }
  return { done, total };
}

/**
 * Postęp każdego folderu = suma zadań w jego notatkach i we wszystkich podfolderach.
 * Liczone są tylko aktywne notatki (bez archiwum i kosza); foldery bez zadań nie trafiają do mapy.
 */
export function folderProgress(notes: Note[], folders: Folder[]): Map<string, Progress> {
  const own = new Map<string, Progress>();
  for (const n of notes) {
    if (!n.folderId || n.archived || n.trashed) continue;
    const p = noteProgress(n);
    if (!p.total) continue;
    const cur = own.get(n.folderId) ?? { done: 0, total: 0 };
    own.set(n.folderId, { done: cur.done + p.done, total: cur.total + p.total });
  }
  const byParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const list = byParent.get(f.parentId ?? null);
    if (list) list.push(f); else byParent.set(f.parentId ?? null, [f]);
  }
  const out = new Map<string, Progress>();
  const visit = (f: Folder, depth: number): Progress => {
    const sum = { ...(own.get(f.id) ?? { done: 0, total: 0 }) };
    if (depth < 20) {
      for (const child of byParent.get(f.id) ?? []) {
        const c = visit(child, depth + 1);
        sum.done += c.done;
        sum.total += c.total;
      }
    }
    if (sum.total) out.set(f.id, sum);
    return sum;
  };
  for (const root of byParent.get(null) ?? []) visit(root, 0);
  return out;
}
