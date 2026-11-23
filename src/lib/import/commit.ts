import type { Folder, Note } from "@/lib/types/note";
import { logDiag } from "@/lib/diagnostics";
import { imageStore } from "@/lib/imageStore";
import { cleanPropDef, findPropDefByName, makePropDef, parsePropInput, PROP_LIMITS, propNameKey, type NoteProps, type PropDef, type PropType } from "@/lib/noteProps";
import { yjsStore } from "@/lib/yjsStore";
import { yieldToMain } from "@/lib/yieldToMain";
import { imageMimeFromName } from "./keep";
import type { ImportPlan, PlannedNote } from "./plan";
import { DANE } from "@/lib/storage/names";

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
  /** Notatki odrzucone przez schemat przy sprawdzaniu — nie zapisane, import idzie dalej (Z-18.8). */
  failed: number;
}

/** Porcja notatek na jedną transakcję Yjs (Z-18.8): jeden zapis do bazy i jedna aktualizacja synchronizacji. */
export const IMPORT_BATCH = 500;
/** Ostatni import — „Cofnij ostatni import” w Ustawieniach przez `LAST_IMPORT_TTL_MS`. Lokalnie, poza kopią. */
export const LAST_IMPORT_KEY = DANE.importLast;
export const LAST_IMPORT_TTL_MS = 24 * 60 * 60 * 1000;

export interface LastImport extends Pick<ImportResult, "noteIds" | "createdFolderIds" | "createdLabels" | "createdPropDefIds"> {
  at: number;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Zapis ostatniego importu, jeśli nie starszy niż doba; śmieci → `null`. */
export function readLastImport(now: number = Date.now()): LastImport | null {
  try {
    const raw = localStorage.getItem(LAST_IMPORT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LastImport>;
    if (typeof v.at !== "number" || now - v.at > LAST_IMPORT_TTL_MS) return null;
    const noteIds = strings(v.noteIds);
    if (!noteIds.length) return null;
    return { at: v.at, noteIds, createdFolderIds: strings(v.createdFolderIds), createdLabels: strings(v.createdLabels), createdPropDefIds: strings(v.createdPropDefIds) };
  } catch {
    return null;
  }
}

export function clearLastImport(): void {
  try { localStorage.removeItem(LAST_IMPORT_KEY); } catch { /* bez localStorage — nic do sprzątania */ }
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
  // Eksport zapisuje zaznaczone „tak/nie” jako „Tak”, a odnośniki z adresem w całości.
  if (values.length > 0 && values.every((v) => /^tak$/i.test(v.trim())) && fits("checkbox")) return "checkbox";
  if (values.length > 0 && values.every((v) => /^https?:\/\//i.test(v.trim())) && fits("url")) return "url";
  return "text";
}

/**
 * Nazwy pól z plików → definicje. Istniejąca definicja o tej samej nazwie (bez wielkości liter)
 * zostaje użyta; nieznane pole powstaje, o ile starczy miejsca (limit `PROP_LIMITS.defs`).
 */
function resolvePropDefs(notes: PlannedNote[], defs: PropDef[], created: PropDef[]): Map<string, PropDef> {
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
    created.push(def);
    out.set(key, def);
  }
  return out;
}

/**
 * Zapisuje plan w bazie (Z-18.8 audytu 2: najpierw sprawdź wszystko, potem zapisz porcjami).
 * 1. Obrazy — błąd zapisu (np. brak miejsca) przerywa, zanim powstanie jakakolwiek notatka.
 * 2. Sprawdzanie bez zapisu: foldery, pola i notatki składane w pamięci; notatka odrzucona przez `noteSchema`
 *    trafia do `failed`, nie przerywa importu.
 * 3. Identyfikatory do `kaczy.import.last.v1` przed pierwszym zapisem — przerwanie w trakcie zostawia listę
 *    do „Cofnij ostatni import” (cofnięcie usuwa tylko to, co istnieje).
 * 4. Zapis: porcje po `IMPORT_BATCH` notatek, każda w jednej transakcji (`yjsStore.importBatch`). Import tylko
 *    dodaje, więc każdy stan pośredni jest bezpieczny.
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

  // 2. Foldery: ponowne użycie istniejącego o tej samej nazwie i rodzicu; nowe tylko w pamięci, zapis w pierwszej porcji.
  const folders: Folder[] = yjsStore.projectFolders();
  const newFolders: Folder[] = [];
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
        newFolders.push(f);
      }
      parentId = f.id;
    }
    return parentId;
  };

  // 3. Właściwości: definicje przed notatkami, żeby wartości miały już do czego wskazywać.
  const newPropDefs: PropDef[] = [];
  const propDefByKey = resolvePropDefs(plan.notes, yjsStore.projectPropDefs(), newPropDefs);

  // 4. Notatki — sprawdzone wszystkie, zanim powstanie pierwszy zapis.
  const knownLabels = new Set(yjsStore.projectLabels());
  const createdLabels = new Set<string>();
  const notes: Note[] = [];
  let imageCount = 0;
  let failed = 0;
  for (const p of plan.notes) {
    // Uszkodzony wpis planu (np. tytuł, który nie jest tekstem) liczy się do `failed`, jak odrzucenie przez schemat.
    let note: Note | null;
    let hashes: string[] = [];
    try {
      hashes = p.images.map((i) => hashBySource.get(i)).filter((h): h is string => typeof h === "string");
      note = buildNote(p, hashes);
    } catch (err) {
      logDiag("warn", "import", "note could not be built", err);
      note = null;
    }
    if (!note) {
      failed++;
      continue;
    }
    notes.push(note);
    imageCount += hashes.length;
    for (const l of note.labels) {
      if (!knownLabels.has(l)) { createdLabels.add(l); knownLabels.add(l); }
    }
  }

  function buildNote(p: PlannedNote, hashes: string[]): Note | null {
    const props: NoteProps = {};
    for (const [name, raw] of Object.entries(p.props ?? {})) {
      const def = propDefByKey.get(propNameKey(name));
      const value = def && parsePropInput(def, String(raw));
      if (def && value !== null && value !== undefined) props[def.id] = value;
    }
    const created = p.createdAt ?? p.updatedAt ?? now;
    const updated = Math.max(p.updatedAt ?? created, created);
    const parsed = noteSchema.safeParse({
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
    if (!parsed.success) {
      logDiag("warn", "import", "note rejected by schema", parsed.error.issues[0]?.message);
      return null;
    }
    return parsed.data;
  }

  // Folder bez żadnej zapisanej notatki (wszystkie odrzucone) nie powstaje.
  const usedFolders = new Set<string>();
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (const n of notes) for (let id = n.folderId; id && !usedFolders.has(id); id = byId.get(id)?.parentId ?? null) usedFolders.add(id);
  const foldersToWrite = newFolders.filter((f) => usedFolders.has(f.id));

  const result: ImportResult = {
    noteIds: notes.map((n) => n.id),
    createdFolderIds: foldersToWrite.map((f) => f.id),
    createdLabels: [...createdLabels],
    createdPropDefIds: newPropDefs.map((d) => d.id),
    imageCount, failedImages, failed,
  };
  if (!notes.length) return result;

  // 3. Lista do cofnięcia przed pierwszym zapisem.
  try {
    const last: LastImport = { at: Date.now(), noteIds: result.noteIds, createdFolderIds: result.createdFolderIds, createdLabels: result.createdLabels, createdPropDefIds: result.createdPropDefIds };
    localStorage.setItem(LAST_IMPORT_KEY, JSON.stringify(last));
  } catch (err) {
    logDiag("warn", "import", "cannot save undo list", err);
  }

  // 4. Zapis porcjami. Pierwsza porcja niesie też foldery, etykiety i pola — notatki mają do czego wskazywać.
  for (let i = 0; i < notes.length; i += IMPORT_BATCH) {
    if (i > 0) await yieldToMain();
    yjsStore.importBatch({
      notes: notes.slice(i, i + IMPORT_BATCH),
      ...(i === 0 ? { folders: foldersToWrite, labels: result.createdLabels, propDefs: newPropDefs } : {}),
    });
  }
  return result;
}

/**
 * Cofa import: usuwa dodane notatki i utworzone przez niego foldery oraz
 * etykiety, których nikt już nie używa. Bajty obrazów sprząta GC magazynu.
 */
export function undoImport(result: Pick<ImportResult, "noteIds" | "createdFolderIds" | "createdLabels" | "createdPropDefIds">): void {
  // Ten sam import nie może zostać cofnięty drugi raz z Ustawień.
  const last = readLastImport();
  if (last && last.noteIds[0] === result.noteIds[0]) clearLastImport();
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
