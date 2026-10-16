import type { Folder, Note } from "@/hooks/useNotes";
import { logDiag } from "@/lib/diagnostics";
import { imageStore } from "@/lib/imageStore";
import { cleanPropDef, findPropDefByName, makePropDef, parsePropInput, PROP_LIMITS, propNameKey, type NoteProps, type PropDef, type PropType } from "@/lib/noteProps";
import { yjsStore } from "@/lib/yjsStore";
import { imageMimeFromName } from "./keep";
import type { ImportPlan, PlannedNote } from "./plan";

export interface ImportResult {
  noteIds: string[];
  /** Foldery utworzone przez import (istniejące zostają użyte ponownie i nie trafiają tutaj). */
  createdFolderIds: string[];
  /** Etykiety, których wcześniej nie było. */
  createdLabels: string[];
  /** Właściwości (definicje), których wcześniej nie było; cofnięcie usuwa je, jeśli nikt ich nie używa. */
  createdPropDefIds: string[];
  imageCount: number;
  failedImages: number;
}

/**
 * Typ nowego pola z wartości z pliku: liczba, data albo tekst. Eksport zapisuje liczby tekstem
 * (z przecinkiem), więc wybiera pierwszy typ, który przyjmie wszystkie wartości tego pola.
 */
function inferPropType(values: string[]): PropType {
  const fits = (type: PropType) => {
    const probe = cleanPropDef({ id: "probe", name: "probe", type, order: 0 });
    return !!probe && values.every((v) => parsePropInput(probe, v) !== undefined);
  };
  if (fits("number")) return "number";
  if (fits("date")) return "date";
  return "text";
}

/**
 * Nazwy pól z plików → definicje. Istniejąca definicja o tej samej nazwie (bez wielkości liter)
 * zostaje użyta; nieznane pole powstaje, o ile starczy miejsca (limit `PROP_LIMITS.defs`).
 */
function resolvePropDefs(notes: PlannedNote[], defs: PropDef[], created: string[]): Map<string, PropDef> {
  const byKey = new Map<string, { name: string; values: string[] }>();
  for (const n of notes) {
    for (const [name, value] of Object.entries(n.props ?? {})) {
      const key = propNameKey(name);
      const entry = byKey.get(key) ?? { name, values: [] };
      entry.values.push(String(value));
      byKey.set(key, entry);
    }
  }
  const out = new Map<string, PropDef>();
  for (const [key, { name, values }] of byKey) {
    const existing = findPropDefByName(defs, name);
    if (existing) { out.set(key, existing); continue; }
    if (defs.length >= PROP_LIMITS.defs) continue;
    const def = makePropDef(defs, name, inferPropType(values));
    if (!def) continue;
    defs.push(def);
    yjsStore.upsertPropDef(def);
    created.push(def.id);
    out.set(key, def);
  }
  return out;
}

/**
 * Zapisuje plan w bazie. Kolejność chroni dane: najpierw obrazy (błąd zapisu
 * — np. brak miejsca — przerywa, zanim powstanie jakakolwiek notatka), potem
 * foldery, etykiety, właściwości i notatki. Każdy zapis przechodzi walidację `noteSchema`.
 */
export async function commitImportPlan(plan: ImportPlan): Promise<ImportResult> {
  const { noteSchema } = await import("@/lib/noteSchema");
  await yjsStore.ready();

  // 1. Obrazy → magazyn (ten sam plik w wielu notatkach = jeden zapis).
  const hashBySource = new Map<unknown, string | null>();
  let failedImages = 0;
  for (const n of plan.notes) {
    for (const img of n.images) {
      if (hashBySource.has(img)) continue;
      let bytes: Uint8Array;
      try { bytes = await img.bytes(); } catch (err) {
        logDiag("warn", "import", "cannot read image", err);
        hashBySource.set(img, null); failedImages++; continue;
      }
      // Błąd zapisu (QuotaExceeded) celowo leci wyżej — nic jeszcze nie zapisano.
      const hash = await imageStore.putBytes(bytes, imageMimeFromName(img.name) ?? "image/jpeg");
      hashBySource.set(img, hash);
    }
  }

  // 2. Foldery: ponowne użycie istniejącego o tej samej nazwie i rodzicu.
  const folders: Folder[] = yjsStore.projectFolders();
  const createdFolderIds: string[] = [];
  const now = Date.now();
  const resolveFolder = (path: string[]): string | null => {
    let parentId: string | null = null;
    for (const raw of path) {
      const name = raw.trim();
      if (!name) continue;
      let f = folders.find((x) => x.parentId === parentId && x.name.trim().toLowerCase() === name.toLowerCase());
      if (!f) {
        f = { id: crypto.randomUUID(), name, color: "default", emoji: null, parentId, order: 0, createdAt: now, updatedAt: now };
        folders.push(f);
        yjsStore.upsertFolder(f);
        createdFolderIds.push(f.id);
      }
      parentId = f.id;
    }
    return parentId;
  };

  // 3. Właściwości: definicje przed notatkami, żeby wartości miały już do czego wskazywać.
  const createdPropDefIds: string[] = [];
  const propDefByKey = resolvePropDefs(plan.notes, yjsStore.projectPropDefs(), createdPropDefIds);

  // 4. Notatki.
  const knownLabels = new Set(yjsStore.projectLabels());
  const createdLabels = new Set<string>();
  const noteIds: string[] = [];
  let imageCount = 0;
  for (const p of plan.notes) {
    const hashes = p.images.map((i) => hashBySource.get(i)).filter((h): h is string => typeof h === "string");
    imageCount += hashes.length;
    const props: NoteProps = {};
    for (const [name, raw] of Object.entries(p.props ?? {})) {
      const def = propDefByKey.get(propNameKey(name));
      const value = def && parsePropInput(def, String(raw));
      if (def && value !== null && value !== undefined) props[def.id] = value;
    }
    const created = p.createdAt ?? p.updatedAt ?? now;
    const updated = Math.max(p.updatedAt ?? created, created);
    const note: Note = noteSchema.parse({
      id: crypto.randomUUID(),
      title: p.title.trim(),
      content: p.content,
      color: p.color,
      pinned: p.pinned && !p.archived,
      ...(p.icon ? { icon: p.icon } : {}),
      ...(p.favorite ? { favorite: true } : {}),
      ...(Object.keys(props).length ? { props } : {}),
      archived: p.archived,
      trashed: false,
      trashedAt: null,
      labels: p.labels,
      reminder: null,
      priority: "none",
      images: hashes,
      checklist: p.checklist.map((c) => ({ id: crypto.randomUUID(), text: c.text, checked: c.checked })),
      folderId: p.folderPath.length ? resolveFolder(p.folderPath) : null,
      order: 0,
      createdAt: created,
      updatedAt: updated,
    });
    yjsStore.upsertNote(note);
    noteIds.push(note.id);
    for (const l of note.labels) {
      if (!knownLabels.has(l)) { createdLabels.add(l); knownLabels.add(l); }
      yjsStore.addLabel(l);
    }
  }

  return { noteIds, createdFolderIds, createdLabels: [...createdLabels], createdPropDefIds, imageCount, failedImages };
}

/**
 * Cofa import: usuwa dodane notatki i utworzone przez niego foldery oraz
 * etykiety, których nikt już nie używa. Bajty obrazów sprząta GC magazynu.
 */
export function undoImport(result: ImportResult): void {
  yjsStore.removeNotes(result.noteIds);
  // Folder zostaje, jeśli ktoś go używa (notatka) albo jest przodkiem takiego folderu.
  const all = yjsStore.projectFolders();
  const byId = new Map(all.map((f) => [f.id, f]));
  const keep = new Set<string>();
  const markChain = (id: string | null) => {
    for (let cur = id; cur && !keep.has(cur); cur = byId.get(cur)?.parentId ?? null) keep.add(cur);
  };
  for (const n of yjsStore.projectNotes()) markChain(n.folderId);
  // Foldery spoza importu i ich przodkowie też zostają (np. dodane do nich w międzyczasie).
  for (const f of all) if (!result.createdFolderIds.includes(f.id)) markChain(f.id);
  for (const id of result.createdFolderIds) {
    if (!keep.has(id)) yjsStore.removeFolder(id);
  }
  const used = new Set(yjsStore.projectNotes().flatMap((n) => n.labels));
  for (const l of result.createdLabels) {
    if (!used.has(l)) yjsStore.removeLabelEverywhere(l);
  }
  // Pole zostaje, jeśli jakaś notatka ma w nim wartość (dodaną po imporcie albo wcześniej).
  const usedProps = new Set(yjsStore.projectNotes().flatMap((n) => Object.keys(n.props ?? {})));
  for (const id of result.createdPropDefIds) {
    if (!usedProps.has(id)) yjsStore.deletePropDef(id);
  }
}
