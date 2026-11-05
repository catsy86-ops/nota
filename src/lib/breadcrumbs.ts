import { LABEL_SEP } from "@/lib/labelTree";

/** Jeden okruszek nad tytułem (nowy plan 5.8): nazwa i cel przejścia. */
export interface Crumb {
  label: string;
  target: { kind: "folder"; id: string } | { kind: "label"; label: string };
}

const MAX_DEPTH = 12;

/** Przodkowie folderu od korzenia (bez niego samego). Pętla w danych (A→B→A) nie zawiesza — limit głębokości. */
export function folderCrumbs(folders: readonly { id: string; name: string; parentId: string | null }[], folderId: string | null): Crumb[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const out: Crumb[] = [];
  const seen = new Set<string>();
  let cur = folderId ? byId.get(folderId)?.parentId ?? null : null;
  while (cur && !seen.has(cur) && out.length < MAX_DEPTH) {
    seen.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    out.unshift({ label: f.name || "Folder", target: { kind: "folder", id: f.id } });
    cur = f.parentId;
  }
  return out;
}

/** Rodzice etykiety zagnieżdżonej: `budowa/łazienka/płytki` → `budowa`, `budowa/łazienka`. */
export function labelCrumbs(label: string | null): Crumb[] {
  if (!label) return [];
  const parts = label.split(LABEL_SEP);
  return parts.slice(0, -1).map((name, i) => ({ label: `#${name}`, target: { kind: "label", label: parts.slice(0, i + 1).join(LABEL_SEP) } }));
}
