import * as Y from "yjs";
import { applyTextEdit, captureTextBase, mapOffset, type TextBase } from "./yTextEdit";
import { IndexeddbPersistence } from "y-indexeddb";
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, getMany as idbGetMany, setMany as idbSetMany } from "idb-keyval";
import { loadAll as loadLegacySnapshot } from "@/lib/notesStore";
import { hashImage } from "@/lib/imageHash";
import type { Note, Folder, ChecklistItem } from "@/hooks/useNotes";
import { logDiag } from "@/lib/diagnostics";

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

/** Stary format: cały słownik obrazów pod jednym kluczem — tylko do migracji. */
const LEGACY_IMAGES_KEY = "kaczy.images.v1";
/** Obrazy jednej notatki pod własnym kluczem — zapis dotyka tylko zmienionych. */
const IMAGES_PREFIX = "kaczy.images.v2:";

type YNote = Y.Map<unknown>;
type YFolder = Y.Map<unknown>;
type YChecklistItem = Y.Map<unknown>;
type ImagesById = Record<string, string[]>;
/** Wspólna pusta lista — stabilna tożsamość dla notatek bez obrazów. */
const NO_IMAGES: string[] = [];

const NOTE_SCALAR_FIELDS = [
  "title", "color", "pinned", "archived", "trashed", "trashedAt",
  "labels", "reminder", "reminderRepeat", "priority",
  "folderId", "order", "createdAt", "updatedAt",
] as const;

const FOLDER_SCALAR_FIELDS = [
  "name", "color", "emoji", "parentId", "order", "createdAt", "updatedAt",
] as const;

/**
 * Common-prefix/suffix diff so unrelated surrounding text keeps stable Yjs positions.
 * Tylko dla zapisów **bez** otwartej sesji edycji (import, szablony, duplikaty):
 * liczy diff od bieżącego stanu CRDT, więc nadpisałby współbieżne zmiany peera.
 * Edytor idzie przez `beginTextEdit` → `applyTextEdit` (patrz `yTextEdit.ts`).
 */
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

/** Checklist is a Y.Map keyed by item id (like notesMap/foldersMap) so concurrent
 *  edits to different items — or the same item's `checked`/`text` — merge
 *  field-by-field instead of one whole-array write clobbering the other.
 *  Item order is tracked via a per-item `order` field, same pattern as note order. */
function yChecklistFromPlain(items: ChecklistItem[]): Y.Map<YChecklistItem> {
  const map = new Y.Map<YChecklistItem>();
  items.forEach((item, index) => {
    const y: YChecklistItem = new Y.Map();
    y.set("id", item.id);
    y.set("text", item.text);
    y.set("checked", item.checked);
    y.set("order", index);
    map.set(item.id, y);
  });
  return map;
}

function plainChecklistFromY(value: unknown): ChecklistItem[] {
  if (value instanceof Y.Map) {
    const items: (ChecklistItem & { order: number })[] = [];
    value.forEach((v, id) => {
      if (v instanceof Y.Map) {
        items.push({
          id,
          text: (v.get("text") as string) ?? "",
          checked: Boolean(v.get("checked")),
          order: (v.get("order") as number) ?? 0,
        });
      }
    });
    items.sort((a, b) => a.order - b.order);
    return items.map(({ order: _order, ...rest }) => rest);
  }
  // Legacy notes persisted before checklist became a Y.Map — self-heals on next patch.
  if (Array.isArray(value)) return value as ChecklistItem[];
  return [];
}

/** Reconciles the checklist Y.Map towards `next`, touching only items that changed
 *  so unrelated concurrent edits (on other items) keep their own Yjs history. */
function applyChecklistDiff(y: YNote, next: ChecklistItem[]) {
  let map = y.get("checklist");
  if (!(map instanceof Y.Map)) {
    map = new Y.Map<YChecklistItem>();
    y.set("checklist", map);
  }
  const checklistMap = map as Y.Map<YChecklistItem>;
  const nextIds = new Set(next.map((i) => i.id));
  for (const id of Array.from(checklistMap.keys())) {
    if (!nextIds.has(id)) checklistMap.delete(id);
  }
  next.forEach((item, index) => {
    const existing = checklistMap.get(item.id);
    if (existing instanceof Y.Map) {
      if (existing.get("text") !== item.text) existing.set("text", item.text);
      if (existing.get("checked") !== item.checked) existing.set("checked", item.checked);
      if (existing.get("order") !== index) existing.set("order", index);
    } else {
      const y2: YChecklistItem = new Y.Map();
      y2.set("id", item.id);
      y2.set("text", item.text);
      y2.set("checked", item.checked);
      y2.set("order", index);
      checklistMap.set(item.id, y2);
    }
  });
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
  y.set("checklist", yChecklistFromPlain(note.checklist));
  y.set("folderId", note.folderId);
  y.set("order", note.order);
  y.set("imageHashes", note.images.map(hashImage));
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
    checklist: plainChecklistFromY(y.get("checklist")),
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
  /** Otwarte sesje edycji: baza, którą widział edytor danej notatki. */
  const textBases = new Map<string, TextBase>();
  const notesMap = doc.getMap<YNote>("notes");
  const foldersMap = doc.getMap<YFolder>("folders");
  const labelsMap = doc.getMap<boolean>("labels");
  const noteCache = new Map<string, Note>();
  const dirtyNotes = new Set<string>();
  notesMap.observeDeep((events) => {
    for (const e of events) {
      if (e.target === notesMap) e.changes.keys.forEach((_c, k) => dirtyNotes.add(k));
      else if (typeof e.path[0] === "string") dirtyNotes.add(e.path[0]);
    }
  });
  const migratedKey = `kaczy.yjs.migrated.v1.${dbName}`;

  let persistence = new IndexeddbPersistence(dbName, doc);
  let imagesCache: ImagesById = {};
  let imagesCacheLoaded = false;
  let readyPromise: Promise<void> | null = null;

  /** Notatki, których obrazy zmieniły się od ostatniego zapisu. */
  const dirtyImages = new Set<string>();
  /** Zapisy idą po kolei — inaczej starszy `set` mógłby wygrać z nowszym `del`. */
  let imagesWriteChain: Promise<void> = Promise.resolve();

  async function ensureImagesCacheLoaded(): Promise<void> {
    if (imagesCacheLoaded) return;
    const imageKeys = (await idbKeys()).filter((k): k is string => typeof k === "string" && k.startsWith(IMAGES_PREFIX));
    const values = await idbGetMany<string[]>(imageKeys);
    const loaded: ImagesById = {};
    imageKeys.forEach((k, i) => { if (values[i]?.length) loaded[k.slice(IMAGES_PREFIX.length)] = values[i]; });

    // Migracja z jednego wielkiego klucza. Stary klucz kasujemy dopiero po
    // udanym zapisie nowych — przerwana migracja powtórzy się przy starcie.
    const legacy = await idbGet<ImagesById>(LEGACY_IMAGES_KEY);
    if (legacy) {
      const toWrite = Object.entries(legacy).filter(([id, imgs]) => !(id in loaded) && imgs?.length);
      await idbSetMany(toWrite.map(([id, imgs]) => [IMAGES_PREFIX + id, imgs]));
      for (const [id, imgs] of toWrite) loaded[id] = imgs;
      await idbDel(LEGACY_IMAGES_KEY);
    }

    // Zmiany zrobione przed załadowaniem (rzadkie) mają pierwszeństwo.
    imagesCache = { ...loaded, ...imagesCache };
    imagesCacheLoaded = true;
  }

  function setImagesSync(noteId: string, images: string[]) {
    if (images.length) imagesCache[noteId] = images;
    else delete imagesCache[noteId];
    dirtyImages.add(noteId);
  }

  function dropImages(noteId: string): boolean {
    if (!(noteId in imagesCache)) return false;
    delete imagesCache[noteId];
    dirtyImages.add(noteId);
    return true;
  }

  /**
   * Zapisuje wyłącznie notatki oznaczone jako zmienione. Wcześniej każde
   * dodanie obrazka przepisywało cały słownik obrazów wszystkich notatek
   * (dziesiątki MB structured-clone na jedno kliknięcie).
   */
  function persistImagesCache() {
    if (!dirtyImages.size) return;
    const batch = [...dirtyImages].map((id) => [id, imagesCache[id]] as const);
    dirtyImages.clear();
    imagesWriteChain = imagesWriteChain.then(async () => {
      for (const [id, imgs] of batch) {
        try {
          if (imgs?.length) await idbSet(IMAGES_PREFIX + id, imgs);
          else await idbDel(IMAGES_PREFIX + id);
        } catch (err) { logDiag("error", "imagesStore", `cannot persist images of note (${imgs?.length ?? 0} images)`, err); }
      }
    });
  }

  /** Liczniki do raportu diagnostycznego — tylko flagi, bez treści notatek. */
  function diagStats() {
    let notes = 0, archived = 0, trashed = 0;
    notesMap.forEach((n) => {
      if (n.get("trashed")) trashed++;
      else if (n.get("archived")) archived++;
      else notes++;
    });
    return {
      counts: { notes, archived, trashed, folders: foldersMap.size, labels: labelsMap.size },
      stateVectorBytes: Y.encodeStateVector(doc).byteLength,
    };
  }

  /** Test-only: czeka na zakończenie zapisów obrazów. */
  function flushImagesForTests(): Promise<void> {
    return imagesWriteChain;
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

  /**
   * Projekcja inkrementalna: notatki nietknięte od ostatniego wywołania
   * zachowują tożsamość obiektu, więc `memo(NoteCard)` i memo filtrów
   * mają co porównywać. Brudne id zbiera obserwator zarejestrowany
   * przy tworzeniu store'a — przed obserwatorami UI.
   */
  function projectNotes(): Note[] {
    const result: Note[] = [];
    notesMap.forEach((y, id) => {
      const images = imagesCache[id] ?? NO_IMAGES;
      let note = noteCache.get(id);
      if (!note || dirtyNotes.has(id) || note.images !== images) {
        note = plainFromYNote(id, y, images);
        noteCache.set(id, note);
      }
      result.push(note);
    });
    dirtyNotes.clear();
    if (noteCache.size > result.length) {
      for (const id of noteCache.keys()) if (!notesMap.has(id)) noteCache.delete(id);
    }
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

  function applyPatch(id: string, y: YNote, updates: Partial<Omit<Note, "id" | "createdAt">>) {
    if (updates.content !== undefined) {
      const text = y.get("content");
      const base = textBases.get(id);
      if (text instanceof Y.Text && base) textBases.set(id, applyTextEdit(text, base, updates.content));
      else if (text instanceof Y.Text) applyTextDiff(text, updates.content);
      else {
        const t = new Y.Text();
        if (updates.content) t.insert(0, updates.content);
        y.set("content", t);
      }
    }
    for (const field of NOTE_SCALAR_FIELDS) {
      if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
    }
    if (updates.checklist !== undefined) applyChecklistDiff(y, updates.checklist);
    if (updates.images !== undefined) y.set("imageHashes", updates.images.map(hashImage));
    if (!("updatedAt" in updates)) y.set("updatedAt", Date.now());
  }

  function patchNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    const y = notesMap.get(id);
    if (!y) return;
    if (updates.images !== undefined) setImagesSync(id, updates.images);
    doc.transact(() => applyPatch(id, y, updates));
    if (updates.images !== undefined) persistImagesCache();
  }

  function patchNotes(ids: string[], updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    let touchedImages = false;
    doc.transact(() => {
      for (const id of ids) {
        const y = notesMap.get(id);
        if (!y) continue;
        if (updates.images !== undefined) { setImagesSync(id, updates.images); touchedImages = true; }
        applyPatch(id, y, updates);
      }
    });
    if (touchedImages) persistImagesCache();
  }

  /**
   * Edytor otwiera sesję, zanim użytkownik zacznie pisać: zapamiętujemy treść
   * i tożsamości znaków, które widzi. Zapisy treści tej notatki idą potem
   * względem tej bazy, więc zmiany peera z czasu edycji nie są kasowane.
   * Zwraca treść bazy — to ona powinna trafić do pola edycji.
   */
  function beginTextEdit(id: string): string | null {
    const text = notesMap.get(id)?.get("content");
    if (!(text instanceof Y.Text)) return null;
    const base = captureTextBase(text);
    textBases.set(id, base);
    return base.text;
  }

  function endTextEdit(id: string): void {
    textBases.delete(id);
  }

  /**
   * Wlewa do otwartego edytora zmiany, które peer zrobił w treści: najpierw
   * scala niezapisany szkic (bez ruszania `updatedAt` — to nie jest zapis
   * użytkownika), potem zwraca aktualny tekst i przeliczone zaznaczenie.
   * `null`, gdy dla tej notatki nie ma otwartej sesji.
   */
  function rebaseTextEdit(id: string, draft: string, selection: [number, number]): { text: string; selection: [number, number] } | null {
    const text = notesMap.get(id)?.get("content");
    const base = textBases.get(id);
    if (!(text instanceof Y.Text) || !base) return null;
    let local = base;
    doc.transact(() => { local = applyTextEdit(text, base, draft); });
    const next = captureTextBase(text);
    textBases.set(id, next);
    return { text: next.text, selection: [mapOffset(local, selection[0], next), mapOffset(local, selection[1], next)] };
  }

  /** Zmiany treści notatki przychodzące od peera (nie z tej karty). */
  function onRemoteTextChange(id: string, listener: () => void): () => void {
    const text = notesMap.get(id)?.get("content");
    if (!(text instanceof Y.Text)) return () => {};
    const handler = (_e: Y.YTextEvent, tr: Y.Transaction) => { if (!tr.local) listener(); };
    text.observe(handler);
    return () => text.unobserve(handler);
  }

  /** Content hashes of a note's images, in order — synced as part of the note
   *  itself (unlike the base64 blobs, which stay device-local in `imagesCache`).
   *  Lets a device that doesn't yet have an image locally know one is expected,
   *  so `imageSync.ts` can fetch it from a connected peer once sync is on. */
  function getImageHashes(id: string): string[] {
    const y = notesMap.get(id);
    if (!y) return [];
    return (y.get("imageHashes") as string[] | undefined) ?? [];
  }

  /** This device's own local copy of a note's images (may lag `getImageHashes`
   *  if some images haven't been fetched from a peer yet). */
  function getLocalImages(id: string): string[] {
    return imagesCache[id] ?? [];
  }

  /**
   * Zmiany wyłącznie lokalne (dziś: dociągnięte obrazy) — poza `Y.Doc`.
   * Wcześniej UI „szturchało się” zapisem `_imgSyncTick` do notatki, który
   * leciał po WebRTC do wszystkich peerów i rósł w historii dokumentu.
   */
  const localListeners = new Set<() => void>();
  function onLocalChange(listener: () => void): () => void {
    localListeners.add(listener);
    return () => { localListeners.delete(listener); };
  }

  /** Called by imageSync.ts once it has fetched a missing image blob from a
   *  peer — merges it into the device-local image cache and notifies
   *  `onLocalChange` subscribers so the UI re-renders with the new image. */
  function setImagesLocal(id: string, images: string[]): void {
    if (!notesMap.has(id)) return;
    setImagesSync(id, images);
    persistImagesCache();
    localListeners.forEach((l) => l());
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
    if (dropImages(id)) persistImagesCache();
  }

  function removeNotes(ids: string[]): void {
    let touchedImages = false;
    doc.transact(() => {
      for (const id of ids) {
        notesMap.delete(id);
        if (dropImages(id)) touchedImages = true;
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
    Object.keys(imagesCache).forEach(dropImages);
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

  /** Pełny stan dokumentu (update V2) + lokalne obrazy — do pliku „sneakernet”. */
  function encodeSyncState(): { update: Uint8Array; images: ImagesById } {
    const images: ImagesById = {};
    for (const [id, imgs] of Object.entries(imagesCache)) if (imgs.length && notesMap.has(id)) images[id] = imgs;
    return { update: Y.encodeStateAsUpdateV2(doc), images };
  }

  /**
   * Scala stan z pliku z bieżącym dokumentem — CRDT merge, nie nadpisanie.
   * Obrazy są adresowane hashem: notatka dostaje obrazy, gdy każdy hash
   * z manifestu da się znaleźć w lokalnej kopii albo w pliku.
   */
  function mergeSyncState(update: Uint8Array, images: ImagesById): { newNotes: number; imagesRestored: number } {
    const before = new Set(notesMap.keys());
    Y.applyUpdateV2(doc, update, "file-merge");
    let newNotes = 0;
    let imagesRestored = 0;
    notesMap.forEach((_y, id) => {
      if (!before.has(id)) newNotes++;
      const hashes = getImageHashes(id);
      const local = imagesCache[id] ?? [];
      if (local.map(hashImage).join("|") === hashes.join("|")) return;
      const pool = new Map<string, string>();
      for (const img of [...local, ...(images[id] ?? [])]) pool.set(hashImage(img), img);
      if (!hashes.every((h) => pool.has(h))) return;
      setImagesSync(id, hashes.map((h) => pool.get(h)!));
      imagesRestored++;
    });
    persistImagesCache();
    if (imagesRestored) localListeners.forEach((l) => l());
    return { newNotes, imagesRestored };
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
    dirtyImages.clear();
    noteCache.clear();
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
    replaceAll, resetForTests, diagStats, encodeSyncState, mergeSyncState,
    getImageHashes, getLocalImages, setImagesLocal,
    beginTextEdit, endTextEdit, rebaseTextEdit, onRemoteTextChange, onLocalChange, flushImagesForTests,
  };
}

export type YjsStore = ReturnType<typeof createYjsStore>;

export const yjsStore = createYjsStore("kaczy-yjs-v1");
