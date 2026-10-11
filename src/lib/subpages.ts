/**
 * Podstrony: notatka może mieć rodzica (`parentId`). Dane pochodzą też od peerów
 * i z importu, więc wszystko tu jest odporne na cykle i wskazania w próżnię:
 * rodzic, którego nie ma (usunięty na stałe), jest traktowany jak brak rodzica —
 * notatka wraca na poziom główny, zamiast znikać z widoku.
 */
import type { Note } from "@/hooks/useNotes";

type Tree = Pick<Note, "id" | "parentId">;

/** Zabezpieczenie przed patologicznie głębokim drzewem (np. zepsutym przez peera). */
export const MAX_DEPTH = 32;

/** Id istniejącego rodzica albo `null` (brak, osierocona, wskazuje na siebie). */
export function parentIdOf(note: Tree, byId: ReadonlyMap<string, Tree>): string | null {
  const p = note.parentId;
  if (!p || p === note.id || !byId.has(p)) return null;
  return p;
}

/** Przodkowie od korzenia do bezpośredniego rodzica; cykl ucina łańcuch w miejscu powtórzenia. */
export function ancestorsOf(id: string, byId: ReadonlyMap<string, Tree>): string[] {
  const chain: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id);
  while (cur && chain.length < MAX_DEPTH) {
    const p = parentIdOf(cur, byId);
    if (!p || seen.has(p)) break;
    seen.add(p);
    chain.unshift(p);
    cur = byId.get(p);
  }
  return chain;
}

/** Wszystkie potomne notatki (dzieci, wnuki…), bez cykli. */
export function descendantIds(id: string, notes: readonly Tree[]): string[] {
  const byId = new Map(notes.map((n) => [n.id, n] as const));
  const kids = new Map<string, string[]>();
  for (const n of notes) {
    const p = parentIdOf(n, byId);
    if (p) kids.set(p, [...(kids.get(p) ?? []), n.id]);
  }
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [id];
  while (queue.length) {
    for (const child of kids.get(queue.shift()!) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      out.push(child);
      queue.push(child);
    }
  }
  return out;
}

/** Bezpośrednie dzieci w kolejności `order`, a przy remisie od najstarszej. */
export function childrenOf(id: string, notes: readonly Note[]): Note[] {
  const byId = new Map(notes.map((n) => [n.id, n] as const));
  return notes
    .filter((n) => parentIdOf(n, byId) === id)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

/** Czy `parentId` może zostać rodzicem `id`: istnieje, to nie ona sama i nie jej potomek. */
export function canSetParent(id: string, parentId: string | null, notes: readonly Tree[]): boolean {
  if (parentId === null) return true;
  if (parentId === id) return false;
  if (!notes.some((n) => n.id === parentId)) return false;
  return !descendantIds(id, notes).includes(parentId);
}

export interface SubpageInfo {
  parentId: string | null;
  parentTitle: string;
  childCount: number;
}

/** Informacje potrzebne kaflom (rodzic, liczba podstron) policzone raz dla całej bazy. */
export function buildSubpageIndex(notes: readonly Note[]): Map<string, SubpageInfo> {
  const byId = new Map(notes.map((n) => [n.id, n] as const));
  const counts = new Map<string, number>();
  for (const n of notes) {
    if (n.trashed) continue;
    const p = parentIdOf(n, byId);
    if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const out = new Map<string, SubpageInfo>();
  for (const n of notes) {
    const p = parentIdOf(n, byId);
    const childCount = counts.get(n.id) ?? 0;
    if (!p && !childCount) continue;
    out.set(n.id, { parentId: p, parentTitle: p ? byId.get(p)!.title.trim() : "", childCount });
  }
  return out;
}
