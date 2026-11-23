import * as Y from "yjs";
import { toast } from "@/lib/notify";
import { METADATA_IN_CIPHERTEXT_SCHEMA, writeFormatAllowed } from "@/lib/formatSchema";
import { applyTextEdit } from "./yTextEdit";
import { IndexeddbPersistence } from "y-indexeddb";
import { trackPersistence } from "@/lib/saveStatus";
import { normalizeAttachments } from "@/lib/attachments";
import { imageStore as defaultImageStore, type ImageStore } from "@/lib/imageStore";
import type { Note, Folder } from "@/lib/types/note";
import { logDiag } from "@/lib/diagnostics";
import { cleanNoteProps, cleanPropDefs, type PropDef } from "@/lib/noteProps";
import { mergeSpec, REMINDER_FIELDS } from "@/lib/reminderSpec";
import { fallbackRepeat } from "@/lib/reminderRepeat";
import { withExclusiveLock, MIGRATION_LOCK } from "@/lib/tabLock";
import { startupReplace } from "@/lib/docReplaceCore";
import {
  type YNote, type YFolder, imageRefs, readReminderState, NOTE_SCALAR_FIELDS, applyTextDiff, applyChecklistDiff,
  applyPropsDiff, type YPropDef, yPropDefFromPlain, PRIVATE_FIELDS, PRIVATE_META, type PrivateFields,
  yNoteFromPlain, plainFromYNote, yFolderFromPlain,
} from "./yjs/codec";
import type { StoreCtx } from "./yjs/context";
import { createTextEditApi } from "./yjs/textEdit";
import { createVaultApi } from "./yjs/vault";
import { createMigrations } from "./yjs/migrations";
import { createTaxonomyApi } from "./yjs/taxonomy";
import { replacePersistedDoc } from "./yjs/docFile";
import { createFileRefsApi } from "./yjs/fileRefs";
import { createBulkReplaceApi } from "./yjs/bulkReplace";

export { FUTURE_CONTENT_KEY } from "./yjs/codec";
export { readDocState, replacePersistedDoc, type DocState } from "./yjs/docFile";

/**
 * Yjs-backed store for notes/folders/labels — the data layer that will let a
 * future device-to-device sync (Yjs CRDT, y-webrtc) merge concurrent edits
 * field-by-field instead of whole-record last-write-wins. This module has no
 * network transport yet: it only replaces the old idb-keyval persistence
 * (`notesStore.ts`) with a Y.Doc persisted via `y-indexeddb`, one-time
 * migrated from whatever `notesStore.ts` already had on disk.
 *
 * Image bytes live OUTSIDE the Y.Doc, in the content-addressed `imageStore`
 * (key = SHA-256). The doc only carries the `imageHashes` manifest — a small
 * list of keys that syncs with the note — and that manifest IS `Note.images`
 * in the projection. Bytes travel separately (`imageSync.ts`, sync file, backup).
 */

export interface YjsStoreOptions {
  /**
   * Przed otwarciem bazy (Z-16.1B): `null` — otwarcie od razu, jak zawsze; obietnica — baza otwiera się dopiero po
   * niej (wymiana dokumentu z zamiaru zapisanego przed przeładowaniem).
   */
  beforeOpen?: (dbName: string) => Promise<void> | null;
}

export function createYjsStore(dbName: string, images: ImageStore = defaultImageStore, opts: YjsStoreOptions = {}) {
  const doc = new Y.Doc();
  const notesMap = doc.getMap<YNote>("notes");
  const foldersMap = doc.getMap<YFolder>("folders");
  const labelsMap = doc.getMap<boolean>("labels");
  const propDefsMap = doc.getMap<YPropDef>("propDefs");
  const noteCache = new Map<string, Note>();
  const dirtyNotes = new Set<string>();
  const vaultMap = doc.getMap<unknown>("vault");
  const ctx: StoreCtx = { doc, notesMap, foldersMap, labelsMap, propDefsMap, vaultMap, noteCache, dirtyNotes, images };
  const {
    textBases, beginTextEdit, getNoteText, endTextEdit, isTextEditOpen, rebaseTextEdit, onRemoteTextChange,
  } = createTextEditApi(ctx);
  const {
    writeLocked, readPlainNote, isLocked, lockedNoteIds, getVault, lockNote, setVault, unlockNote,
    getFutureContent, getVaultMeta, setVaultMeta, observeVaultMeta, rekeyVault, setLockedWriteSink,
  } = createVaultApi(ctx, textBases);
  const {
    projectFolders, projectLabels, projectPropDefs, upsertPropDef, deletePropDef, upsertFolder, patchFolder,
    removeFolder, addLabel, removeLabelEverywhere, renameLabelEverywhere,
  } = createTaxonomyApi(ctx);
  const { referencedImages, noteFileRefs, referencedAttachments, syncableRefs } = createFileRefsApi(ctx);
  const { replaceAll, isBulkWriting, onBulkWriteEnd, replaceAllChunked } = createBulkReplaceApi(ctx);
  notesMap.observeDeep((events) => {
    for (const e of events) {
      if (e.target === notesMap) e.changes.keys.forEach((_c, k) => dirtyNotes.add(k));
      else if (typeof e.path[0] === "string") dirtyNotes.add(e.path[0]);
    }
  });
  const migratedKey = `kaczy.yjs.migrated.v1.${dbName}`;
  const { remapImageRefs, migrateImagesToStore, migrateFromLegacyIfNeeded } = createMigrations(ctx, migratedKey);

  // Zwykle trwałość powstaje od razu. Przy zamiarze wymiany dokumentu — dopiero po wymianie bazy (`opened`).
  const pendingOpen = opts.beforeOpen?.(dbName) ?? null;
  let persistence: IndexeddbPersistence = pendingOpen ? (null as unknown as IndexeddbPersistence) : new IndexeddbPersistence(dbName, doc);
  const opened: Promise<void> = pendingOpen ? pendingOpen.then(() => { persistence = new IndexeddbPersistence(dbName, doc); }) : Promise.resolve();
  trackPersistence(doc, () => persistence);
  let readyPromise: Promise<void> | null = null;

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

  function ready(): Promise<void> {
    if (!readyPromise) {
      readyPromise = (async () => {
        await opened;
        // Zablokowane IndexedDB (tryb prywatny, brak miejsca) nie może zawiesić aplikacji
        // na „ładowaniu”: po 8 s idziemy dalej na samej pamięci, a zapis zgłaszamy w diagnostyce.
        let timer: ReturnType<typeof setTimeout> | undefined;
        const synced = await Promise.race([
          persistence.whenSynced.then(() => true, () => false),
          new Promise<boolean>((r) => { timer = setTimeout(() => r(false), 8000); }),
        ]);
        if (timer) clearTimeout(timer);
        if (!synced) logDiag("error", "yjs", "IndexedDB nie odpowiada — zmiany mogą nie zostać zapisane");
        await images.load();
        // Jedna karta naraz: druga czeka i zastaje już zrobioną migrację (flagi w localStorage).
        await withExclusiveLock(MIGRATION_LOCK, async () => {
          await migrateImagesToStore();
          await migrateFromLegacyIfNeeded();
        });
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
      let note = noteCache.get(id);
      if (!note || dirtyNotes.has(id)) {
        note = plainFromYNote(id, y);
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

  function upsertNote(note: Note): void {
    doc.transact(() => {
      notesMap.set(note.id, yNoteFromPlain(note));
    });
  }

  function applyPatch(id: string, y: YNote, updates: Partial<Omit<Note, "id" | "createdAt">>) {
    if (y.get("locked") === true) {
      // Notatka prywatna: pól treści nie wolno zapisać jawnie. Idą do sesji skarbca,
      // która zaszyfruje je i zapisze `vault` (patrz `privateNotes.ts`).
      const rest: Record<string, unknown> = { ...updates };
      const priv: Record<string, unknown> = {};
      const metaSecret = writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA);
      for (const f of [...PRIVATE_FIELDS, ...(metaSecret ? PRIVATE_META : [])] as string[]) {
        if (f in rest) { priv[f] = rest[f]; delete rest[f]; }
      }
      delete rest.locked;
      delete rest.vault;
      // Właściwości nie są w szyfrogramie — przy notatce prywatnej pomijamy je po cichu.
      delete rest.props;
      const accepted = Object.keys(priv).length === 0 || writeLocked(id, priv as PrivateFields);
      // Przegląd V-3 (punkt 1): metadane przy zablokowanym skarbcu NIE zapisują się jawnie — odrzucamy je
      // i mówimy o tym użytkownikowi. Przy zamkniętej bramce schematu zostaje dotychczasowe zachowanie (jawne).
      if (!accepted && metaSecret && (PRIVATE_META as readonly string[]).some((f) => f in priv)) {
        toast.info("Odblokuj skarbiec, aby zmienić kolor, folder lub rodzica notatki prywatnej", { id: "private-meta-locked" });
      }
      if (!accepted && !metaSecret) for (const f of PRIVATE_META) if (f in priv) rest[f] = priv[f];
      updates = rest as typeof updates;
    }
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
    // Przypomnienie idzie jednym zapisem `reminderSpec` — bieżący stan czytamy przed nadpisaniem pól.
    const remBefore = REMINDER_FIELDS.some((f) => f in updates) ? readReminderState(y) : null;
    for (const field of NOTE_SCALAR_FIELDS) {
      if (field in updates) y.set(field, (updates as Record<string, unknown>)[field]);
    }
    // Zapasowy rodzaj z reguły zapisuje się także w polu sprzed zmiany (starsze wersje czytają je, nie `reminderSpec`).
    if (updates.reminderRule) y.set("reminderRepeat", fallbackRepeat(updates.reminderRule));
    if (remBefore) y.set("reminderSpec", mergeSpec(remBefore, updates));
    if (updates.checklist !== undefined) applyChecklistDiff(y, updates.checklist);
    if (updates.images !== undefined) y.set("imageHashes", imageRefs(updates.images));
    if (updates.attachments !== undefined) y.set("attachments", normalizeAttachments(updates.attachments));
    if (updates.props !== undefined) applyPropsDiff(y, cleanNoteProps(updates.props));
    if (!("updatedAt" in updates)) y.set("updatedAt", Date.now());
  }

  function patchNote(id: string, updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    const y = notesMap.get(id);
    if (!y) return;
    doc.transact(() => applyPatch(id, y, updates));
  }

  function patchNotes(ids: string[], updates: Partial<Omit<Note, "id" | "createdAt">>): void {
    doc.transact(() => {
      for (const id of ids) {
        const y = notesMap.get(id);
        if (y) applyPatch(id, y, updates);
      }
    });
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

  /**
   * Import (Z-18.8 audytu 2): porcja notatek z folderami, etykietami i polami w jednej transakcji — jeden zapis do bazy
   * i jedna aktualizacja dla synchronizacji zamiast jednej na notatkę. Wewnętrzne `transact` łączą się z zewnętrzną.
   */
  function importBatch(batch: { notes: readonly Note[]; folders?: readonly Folder[]; labels?: readonly string[]; propDefs?: readonly PropDef[] }): void {
    doc.transact(() => {
      for (const d of batch.propDefs ?? []) upsertPropDef(d);
      for (const f of batch.folders ?? []) upsertFolder(f);
      for (const l of batch.labels ?? []) addLabel(l);
      for (const n of batch.notes) upsertNote(n);
    });
  }

  /** Bajty obrazów zostają w `imageStore` — sprząta je GC po karencji. */
  function removeNote(id: string): void {
    doc.transact(() => { notesMap.delete(id); });
  }

  function removeNotes(ids: string[]): void {
    doc.transact(() => {
      for (const id of ids) notesMap.delete(id);
    });
  }

  /**
   * Kopie notatek z kopii dziennej (Z-16.1B, `docs/plan-dane-lokalne.md` §1.5) w **jednej** transakcji: folder
   * (istniejący o tej nazwie na najwyższym poziomie albo nowy), brakujące etykiety i definicje pól, potem notatki —
   * już z nowymi identyfikatorami i szyfrogramami (notatki prywatne przygotowuje wołający). Oryginały nietknięte.
   */
  function insertNoteCopies(copies: Note[], folder: Folder, propDefs: PropDef[]): string {
    let folderId = folder.id;
    doc.transact(() => {
      const existing = projectFolders().find((f) => f.name === folder.name && !f.parentId);
      if (existing) folderId = existing.id;
      else foldersMap.set(folder.id, yFolderFromPlain(folder));
      for (const def of cleanPropDefs(propDefs)) if (!propDefsMap.has(def.id)) propDefsMap.set(def.id, yPropDefFromPlain(def));
      for (const note of copies) {
        for (const l of note.labels) if (!labelsMap.has(l)) labelsMap.set(l, true);
        notesMap.set(note.id, yNoteFromPlain({ ...note, folderId }));
      }
    });
    return folderId;
  }

  /**
   * Dziennik aktualizacji y-indexeddb trzyma dawne aktualizacje (z jawnym
   * tekstem sprzed zablokowania) aż do własnego zagęszczenia. Tu zagęszczamy
   * od razu: jedna aktualizacja ze stanem dokumentu zamiast historii.
   * Nie dotyczy innych urządzeń ani wcześniejszych kopii zapasowych.
   */
  async function compactPersistence(): Promise<boolean> {
    try {
      await persistence.whenSynced;
      const db = persistence.db;
      if (!db) return false;
      const state = Y.encodeStateAsUpdate(doc);
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(["updates"], "readwrite");
        const store = tx.objectStore("updates");
        const keysReq = store.getAllKeys();
        keysReq.onsuccess = () => {
          const old = keysReq.result;
          const addReq = store.add(state);
          addReq.onsuccess = () => { for (const k of old) store.delete(k); };
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (err) {
      logDiag("warn", "yjsStore", "cannot compact persistence", err);
      return false;
    }
  }

  /** Pełny stan dokumentu (update V2) — do pliku „sneakernet”. Bajty obrazów dokłada `yjsFileSync`. */
  function encodeSyncState(): Uint8Array {
    return Y.encodeStateAsUpdateV2(doc);
  }

  /** Wektor stanu dokumentu — do nagłówka kopii dziennej (`dailySnapshot.ts`). */
  function encodeStateVector(): Uint8Array {
    return Y.encodeStateVector(doc);
  }

  /** Scala stan z pliku z bieżącym dokumentem — CRDT merge, nie nadpisanie. */
  function mergeSyncState(update: Uint8Array): { newNotes: number } {
    const before = new Set(notesMap.keys());
    Y.applyUpdateV2(doc, update, "file-merge");
    let newNotes = 0;
    notesMap.forEach((_y, id) => { if (!before.has(id)) newNotes++; });
    return { newNotes };
  }

  /** Test-only: destroy this store's Yjs doc/IDB persistence, and start fresh. */
  async function resetForTests(): Promise<void> {
    await persistence.clearData();
    // Wszystkie mapy dokumentu — także te, które dokładają inne moduły (Grafik).
    doc.transact(() => {
      doc.share.forEach((type) => {
        if (type instanceof Y.Map) Array.from(type.keys()).forEach((k) => type.delete(k));
      });
    });
    noteCache.clear();
    readyPromise = null;
    try { localStorage.removeItem(migratedKey); } catch { /* ignore */ }
    persistence = new IndexeddbPersistence(dbName, doc);
  }

  /** Czy transakcja to wczytanie z IndexedDB (origin y-indexeddb) — dla synchronizacji kart. */
  const isPersistenceOrigin = (origin: unknown) => origin != null && origin === persistence;

  return {
    doc, notesMap, foldersMap, labelsMap, images, isPersistenceOrigin,
    ready, projectNotes, projectFolders, projectLabels, projectPropDefs, upsertPropDef, deletePropDef, propDefsMap,
    upsertNote, patchNote, patchNotes, setNoteOrder, removeNote, removeNotes, importBatch, noteFileRefs,
    upsertFolder, patchFolder, removeFolder, insertNoteCopies,
    addLabel, removeLabelEverywhere, renameLabelEverywhere,
    replaceAll, replaceAllChunked, isBulkWriting, onBulkWriteEnd, resetForTests, diagStats, encodeSyncState, encodeStateVector, mergeSyncState,
    referencedImages, referencedAttachments, syncableRefs, remapImageRefs,
    beginTextEdit, endTextEdit, isTextEditOpen, rebaseTextEdit, onRemoteTextChange, getNoteText,
    readPlainNote, isLocked, lockedNoteIds, getVault, lockNote, setVault, unlockNote, getFutureContent,
    getVaultMeta, setVaultMeta, observeVaultMeta, rekeyVault, setLockedWriteSink, compactPersistence,
  };
}

export type YjsStore = ReturnType<typeof createYjsStore>;

export const yjsStore = createYjsStore("kaczy-yjs-v1", defaultImageStore, {
  beforeOpen: (name) => startupReplace(name, replacePersistedDoc),
});
