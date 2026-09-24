import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { loadAll as loadLegacySnapshot } from "@/lib/notesStore";
import type { Note, Folder } from "@/hooks/useNotes";

/**
 * Yjs-backed store for notes/folders/labels — the data layer that will let a
 * future device-to-device sync (Yjs CRDT, y-webrtc) merge concurrent edits
 * field-by-field instead of whole-record last-write-wins. This module has no
 * network transport yet: it only replaces the old idb-keyval persistence
 * (`notesStore.ts`) with a Y.Doc persisted via `y-indexeddb`, one-time
 * migrated from whatever `notesStore.ts` already had on disk.
 *
 * `images` (base64 data URLs) deliberately live OUTSIDE the Y.Doc, in a
 * separate device-local idb-keyval store — they can be large, and a future
 * peer-to-peer transport would otherwise ship them over the wire to every
 * peer. Each device keeps its own images; only note/folder/label metadata is
 * meant to eventually sync.
 */

const IMAGES_KEY = "kaczy.images.v1";

type YNote = Y.Map<unknown>;
type YFolder = Y.Map<unknown>;
type ImagesById = Record<string, string[]>;

const NOTE_SCALAR_FIELDS = [
  "title", "color", "pinned", "archived", "trashed", "trashedAt",
  "labels", "reminder", "reminderRepeat", "priority", "checklist",
  "folderId", "order", "createdAt", "updatedAt",
] as const;

const FOLDER_SCALAR_FIELDS = [
  "name", "color", "emoji", "parentId", "order", "createdAt", "updatedAt",
] as const;

/** Common-prefix/suffix diff so unrelated surrounding text keeps stable Yjs positions. */
function applyTextDiff(ytext: Y.Text, next: string) {
  const prev = ytext.toString();
  if (prev === next) return;
  const maxStart = Math.min(prev.length, next.length);
  let start = 0;
  while (start < maxStart && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--; endNext--;
  }
  if (endPrev > start) ytext.delete(start, endPrev - start);
  if (endNext > start) ytext.insert(start, next.slice(start, endNext));
}

function yNoteFromPlain(note: Note): YNote {
  const y: YNote = new Y.Map();
  const text = new Y.Text();
  if (note.content) text.insert(0, note.content);
  y.set("content", text);
  y.set("title", note.title);
  y.set("color", note.color);
  y.set("pinned", note.pinned);
  y.set("archived", note.archived);
  y.set("trashed", note.trashed);
  y.set("trashedAt", note.trashedAt);
  y.set("labels", note.labels.slice());
  y.set("reminder", note.reminder);
  if (note.reminderRepeat !== undefined) y.set("reminderRepeat", note.reminderRepeat);
  y.set("priority", note.priority);
  y.set("checklist", note.checklist.map((c) => ({ ...c })));
  y.set("folderId", note.folderId);
  y.set("order", note.order);
  y.set("createdAt", note.createdAt);
  y.set("updatedAt", note.updatedAt);
  return y;
}

function plainFromYNote(id: string, y: YNote, images: string[]): Note {
  const content = y.get("content");
  return {
    id,
    title: (y.get("title") as string) ?? "",
    content: content instanceof Y.Text ? content.toString() : ((content as string) ?? ""),
    color: (y.get("color") as Note["color"]) ?? "default",
    pinned: Boolean(y.get("pinned")),
    archived: Boolean(y.get("archived")),
    trashed: Boolean(y.get("trashed")),
    trashedAt: (y.get("trashedAt") as number | null) ?? null,
    labels: (y.get("labels") as string[] | undefined) ?? [],
    reminder: (y.get("reminder") as number | null) ?? null,
    reminderRepeat: y.get("reminderRepeat") as Note["reminderRepeat"],
    priority: (y.get("priority") as Note["priority"]) ?? "none",
    images,
    checklist: (y.get("checklist") as Note["checklist"] | undefined) ?? [],
    folderId: (y.get("folderId") as string | null) ?? null,
    order: (y.get("order") as number) ?? 0,
    createdAt: (y.get("createdAt") as number) ?? 0,
    updatedAt: (y.get("updatedAt") as number) ?? 0,
  };
}

function yFolderFromPlain(folder: Folder): YFolder {
  const y: YFolder = new Y.Map();
  y.set("name", folder.name);
  y.set("color", folder.color);
  y.set("emoji", folder.emoji);
  y.set("parentId", folder.parentId);
  y.set("order", folder.order);
  y.set("createdAt", folder.createdAt);
  y.set("updatedAt", folder.updatedAt ?? folder.createdAt);
  return y;
}

function plainFromYFolder(id: string, y: YFolder): Folder {
  return {
    id,
    name: (y.get("name") as string) ?? "",
    color: (y.get("color") as Folder["color"]) ?? "default",
    emoji: (y.get("emoji") as string | null) ?? null,
    parentId: (y.get("parentId") as string | null) ?? null,
    order: (y.get("order") as number) ?? 0,
    createdAt: (y.get("createdAt") as number) ?? 0,
    updatedAt: (y.get("updatedAt") as number | undefined) ?? (y.get("createdAt") as number) ?? 0,
  };
}

export function createYjsStore(dbName: string) {
  const doc = new Y.Doc();
  const notesMap = doc.getMap<YNote>("notes");
  const foldersMap = doc.getMap<YFolder>("folders");
  const labelsMap = doc.getMap<boolean>("labels");
  const migratedKey = `kaczy.yjs.migrated.v1.${dbName}`;

  let persistence = new IndexeddbPersistence(dbName, doc);
  let imagesCache: ImagesById = {};
  let imagesCacheLoaded = false;
  let readyPromise: Promise<void> | null = null;

  async function ensureImagesCacheLoaded(): Promise<void> {
    if (imagesCacheLoaded) return;
    imagesCache = (await idbGet<ImagesById>(IMAGES_KEY)) ?? {};
    imagesCacheLoaded = true;
  }

  function setImagesSync(noteId: string, images: string[]) {
    if (images.length) imagesCache[noteId] = images;
    else delete imagesCache[noteId];
  }

  function persistImagesCache() {
    void idbSet(IMAGES_KEY, imagesCache).catch(() => { /* best-effort, same as old saveNotesIDB */ });
  }

  async function migrateFromLegacyIfNeeded(): Promise<void> {
    let migrated = false;
    try { migrated = Boolean(localStorage.getItem(migratedKey)); } catch { /* ignore */ }
    if (migrated) return;

    if (notesMap.size > 0 || foldersMap.size > 0 || labelsMap.size > 0) {
      // Doc already has content (e.g. persisted before the flag existed) — nothing to migrate.
      try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
      return;
    }

    const snapshot = await loadLegacySnapshot();
    if (snapshot.notes.length || snapshot.folders.length || snapshot.labels.length) {
      doc.transact(() => {
        for (const note of snapshot.notes) notesMap.set(note.id, yNoteFromPlain(note));
        for (const folder of snapshot.folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
        for (const label of snapshot.labels) labelsMap.set(label, true);
      });
      for (const note of snapshot.notes) setImagesSync(note.id, note.images);
      persistImagesCache();
    }
    try { localStorage.setItem(migratedKey, "1"); } catch { /* ignore */ }
  }

  function ready(): Promise<void> {
    if (!readyPromise) {
      readyPromise = (async () => {
        await persistence.whenSynced;
        await ensureImagesCacheLoaded();
        await migrateFromLegacyIfNeeded();
      })();
    }
    return readyPromise;
  }

  function projectNotes(): Note[] {
    const result: Note[] = [];
    notesMap.forEach((y, id) => result.push(plainFromYNote(id, y, imagesCache[id] ?? [])));
    return result;
  }

  function projectFolders(): Folder[] {
    const result: Folder[] = [];
    foldersMap.forEach((y, id) => result.push(plainFromYFolder(id, y)));
    return result;
  }

  function projectLabels(): string[] {
    return Array.from(labelsMap.keys()).sort((a, b) => a.localeCompare(b));
  }

  function upsertNote(note: Note): void {
    setImagesSync(note.id, note.images);
    doc.transact(() => {
      notesMap.set(note.id, yNoteFromPlain(note));
    });
    persistImagesCache();
  }

  function applyPatch(y: YNote, updates: Partial<Omit<Note, "id" | "createdAt">>) {
    if (updates.content !== undefined) {
      const text = y.get("content");
      if (text instanceof Y.Text) applyTextDiff(text, updates.content);
      else {
        const t = new Y.Text();
        if (updates.content) t.insert(0, updates.content);
        y.set("content", t);
      }
    }
    for (const field of NOTE_SCALAR_FIELDS) {
      if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
    }
    if (!("updatedAt" in updates)) y.set("updatedAt", Date.now());
  }

  function patchNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    const y = notesMap.get(id);
    if (!y) return;
    if (updates.images !== undefined) setImagesSync(id, updates.images);
    doc.transact(() => applyPatch(y, updates));
    if (updates.images !== undefined) persistImagesCache();
  }

  function patchNotes(ids: string[], updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    let touchedImages = false;
    doc.transact(() => {
      for (const id of ids) {
        const y = notesMap.get(id);
        if (!y) continue;
        if (updates.images !== undefined) { setImagesSync(id, updates.images); touchedImages = true; }
        applyPatch(y, updates);
      }
    });
    if (touchedImages) persistImagesCache();
  }

  /** Persists a manual drag order (index per id) in one transaction. */
  function setNoteOrder(ids: string[]): void {
    doc.transact(() => {
      ids.forEach((id, index) => {
        const y = notesMap.get(id);
        if (y) y.set("order", index);
      });
    });
  }

  function removeNote(id: string): void {
    doc.transact(() => { notesMap.delete(id); });
    if (id in imagesCache) {
      delete imagesCache[id];
      persistImagesCache();
    }
  }

  function removeNotes(ids: string[]): void {
    let touchedImages = false;
    doc.transact(() => {
      for (const id of ids) {
        notesMap.delete(id);
        if (id in imagesCache) { delete imagesCache[id]; touchedImages = true; }
      }
    });
    if (touchedImages) persistImagesCache();
  }

  function upsertFolder(folder: Folder): void {
    doc.transact(() => { foldersMap.set(folder.id, yFolderFromPlain(folder)); });
  }

  function patchFolder(id: string, updates: Partial<Omit<Folder, "id" | "createdAt">>): void {
    const y = foldersMap.get(id);
    if (!y) return;
    doc.transact(() => {
      for (const field of FOLDER_SCALAR_FIELDS) {
        if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
      }
      y.set("updatedAt", Date.now());
    });
  }

  function removeFolder(id: string): void {
    doc.transact(() => { foldersMap.delete(id); });
  }

  function addLabel(label: string): void {
    if (labelsMap.has(label)) return;
    doc.transact(() => { labelsMap.set(label, true); });
  }

  /** Removes a label from the label set and strips it from every note, in one transaction. */
  function removeLabelEverywhere(label: string): void {
    doc.transact(() => {
      labelsMap.delete(label);
      notesMap.forEach((y) => {
        const labels = (y.get("labels") as string[] | undefined) ?? [];
        if (labels.includes(label)) y.set("labels", labels.filter((l) => l !== label));
      });
    });
  }

  /** Renames a label in the label set and in every note referencing it, in one transaction. */
  function renameLabelEverywhere(oldLabel: string, newLabel: string): void {
    doc.transact(() => {
      if (labelsMap.has(oldLabel)) labelsMap.delete(oldLabel);
      labelsMap.set(newLabel, true);
      notesMap.forEach((y) => {
        const labels = (y.get("labels") as string[] | undefined) ?? [];
        if (labels.includes(oldLabel)) {
          y.set("labels", labels.map((l) => (l === oldLabel ? newLabel : l)));
        }
      });
    });
  }

  /** Destructive full replace (used by "restore from backup file") — not a merge. */
  function replaceAll(notes: Note[], folders: Folder[], labels: string[]): void {
    imagesCache = {};
    doc.transact(() => {
      notesMap.forEach((_v, k) => notesMap.delete(k));
      foldersMap.forEach((_v, k) => foldersMap.delete(k));
      labelsMap.forEach((_v, k) => labelsMap.delete(k));
      for (const note of notes) notesMap.set(note.id, yNoteFromPlain(note));
      for (const folder of folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
      for (const label of labels) labelsMap.set(label, true);
    });
    for (const note of notes) setImagesSync(note.id, note.images);
    persistImagesCache();
  }

  /** Test-only: destroy this store's Yjs doc/IDB persistence and images, and start fresh. */
  async function resetForTests(): Promise<void> {
    await persistence.clearData();
    doc.transact(() => {
      notesMap.forEach((_v, k) => notesMap.delete(k));
      foldersMap.forEach((_v, k) => foldersMap.delete(k));
      labelsMap.forEach((_v, k) => labelsMap.delete(k));
    });
    imagesCache = {};
    imagesCacheLoaded = false;
    readyPromise = null;
    try { localStorage.removeItem(migratedKey); } catch { /* ignore */ }
    persistence = new IndexeddbPersistence(dbName, doc);
  }

  return {
    doc, notesMap, foldersMap, labelsMap,
    ready, projectNotes, projectFolders, projectLabels,
    upsertNote, patchNote, patchNotes, setNoteOrder, removeNote, removeNotes,
    upsertFolder, patchFolder, removeFolder,
    addLabel, removeLabelEverywhere, renameLabelEverywhere,
    replaceAll, resetForTests,
  };
}

export type YjsStore = ReturnType<typeof createYjsStore>;

export const yjsStore = createYjsStore("kaczy-yjs-v1");
