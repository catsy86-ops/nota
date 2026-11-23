import { yieldToMain } from "@/lib/yieldToMain";
import * as Y from "yjs";
import { toast } from "@/lib/notify";
import { METADATA_IN_CIPHERTEXT_SCHEMA, writeFormatAllowed } from "@/lib/formatSchema";
import { applyTextEdit } from "./yTextEdit";
import { IndexeddbPersistence } from "y-indexeddb";
import { trackPersistence } from "@/lib/saveStatus";
import { normalizeAttachments, isAttachmentSyncable, type Attachment } from "@/lib/attachments";
import { imageStore as defaultImageStore, type ImageStore } from "@/lib/imageStore";
import type { Note, Folder } from "@/lib/types/note";
import { logDiag } from "@/lib/diagnostics";
import { cleanNoteProps, cleanPropDefs, type PropDef } from "@/lib/noteProps";
import { mergeSpec, REMINDER_FIELDS } from "@/lib/reminderSpec";
import { fallbackRepeat } from "@/lib/reminderRepeat";
import { journalRefsIn } from "@/lib/study/journalRefs";
import { planRefsIn } from "@/lib/plans/planRefs";
import { debtProofRefsIn } from "@/lib/debts/proofs";
import { withExclusiveLock, MIGRATION_LOCK } from "@/lib/tabLock";
import { startupReplace } from "@/lib/docReplaceCore";
import {
  type YNote, type YFolder, imageRefs, readReminderState, NOTE_SCALAR_FIELDS, applyTextDiff, applyChecklistDiff,
  applyPropsDiff, type YPropDef, yPropDefFromPlain, plainPropDefFromY, plainAttachments, PRIVATE_FIELDS,
  PRIVATE_META, type PrivateFields, yNoteFromPlain, plainFromYNote, yFolderFromPlain, plainFromYFolder,
} from "./yjs/codec";
import type { StoreCtx } from "./yjs/context";
import { createTextEditApi } from "./yjs/textEdit";
import { createVaultApi } from "./yjs/vault";
import { createMigrations } from "./yjs/migrations";
import { createTaxonomyApi } from "./yjs/taxonomy";
export { FUTURE_CONTENT_KEY } from "./yjs/codec";

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

/** Stan dokumentu odczytany z kopii (Z-16.1B): tylko do porównania i kopiowania, nic nie jest scalane. */
export interface DocState {
  notes: Note[];
  folders: Folder[];
  propDefs: PropDef[];
  vaultMeta: unknown;
}

/**
 * Odczyt pełnego stanu (update V2, np. kopia dzienna) do **osobnego** `Y.Doc` w pamięci — niepodłączonego do bazy,
 * synchronizacji ani kart. Wczytanie starej migawki do działającego dokumentu niczego by nie cofnęło (Yjs scala,
 * nowszy stan wygrywa), dlatego przywracanie czyta ją obok. Uszkodzona aktualizacja rzuca.
 */
export function readDocState(update: Uint8Array): DocState {
  const doc = new Y.Doc();
  try {
    Y.applyUpdateV2(doc, update);
    const notes: Note[] = [];
    doc.getMap<YNote>("notes").forEach((y, id) => notes.push(plainFromYNote(id, y)));
    const folders: Folder[] = [];
    doc.getMap<YFolder>("folders").forEach((y, id) => folders.push(plainFromYFolder(id, y)));
    const defs: PropDef[] = [];
    doc.getMap<YPropDef>("propDefs").forEach((y, id) => {
      const def = plainPropDefFromY(id, y);
      if (def) defs.push(def);
    });
    return { notes, folders, propDefs: cleanPropDefs(defs), vaultMeta: doc.getMap<unknown>("vault").get("meta") };
  } finally {
    doc.destroy();
  }
}

/** Czas na zamknięcie połączeń innych kart przy podniesieniu wersji bazy. */
const BLOCKED_TIMEOUT_MS = 10_000;

/**
 * Otwarcie bazy dokumentu bez y-indexeddb w **nowej wersji**: zmiana wersji wysyła \`versionchange\` do wszystkich
 * otwartych połączeń, a \`lib0/indexeddb\` je wtedy zamyka. Karta ze starym dokumentem (zamrożona, starsza wersja
 * aplikacji) traci więc połączenie, zanim baza zostanie wyczyszczona, i nie dopisze starego stanu po wymianie.
 * Brakujące magazyny (\`updates\` z autonumerem, \`custom\`) są zakładane przy tej samej zmianie wersji.
 */
async function openDocDbExclusive(dbName: string): Promise<IDBDatabase> {
  const current = await new Promise<number>((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => { const v = req.result.version; req.result.close(); resolve(v); };
    req.onerror = () => reject(req.error);
  });
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, current + 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("updates")) db.createObjectStore("updates", { autoIncrement: true });
      if (!db.objectStoreNames.contains("custom")) db.createObjectStore("custom");
    };
    req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
    req.onerror = () => { clearTimeout(timer); reject(req.error); };
    // Zablokowane = inna karta jeszcze nie zamknęła połączenia; czekamy, ale nie bez końca.
    req.onblocked = () => {
      timer ??= setTimeout(() => reject(new Error("inna karta trzyma bazę — zamknij pozostałe karty aplikacji")), BLOCKED_TIMEOUT_MS);
    };
  });
}

/**
 * Wymiana zapisanego dokumentu (Z-16.1B, ścieżka awaryjna): **jedna transakcja** — wyczyszczenie aktualizacji
 * i zapis pełnego stanu z kopii (albo nic — pusty dokument). Przerwanie zostawia stary albo nowy stan, nigdy pustą
 * bazę w połowie. Wołać tylko przed otwarciem \`IndexeddbPersistence\` (hak \`beforeOpen\`). Uszkodzona kopia rzuca
 * przed dotknięciem bazy; błąd otwarcia rzuca (bez usuwania bazy — to zrobi najwyżej użytkownik).
 */
export async function replacePersistedDoc(dbName: string, updateV2: Uint8Array | null): Promise<void> {
  let v1: Uint8Array | null = null;
  if (updateV2) {
    const check = new Y.Doc();
    try {
      Y.applyUpdateV2(check, updateV2);
      v1 = Y.encodeStateAsUpdate(check);
    } finally {
      check.destroy();
    }
  }
  const db = await openDocDbExclusive(dbName);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["updates", "custom"], "readwrite");
      tx.objectStore("updates").clear();
      tx.objectStore("custom").clear();
      if (v1) tx.objectStore("updates").add(v1);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("transakcja przerwana"));
    });
  } finally {
    db.close();
  }
}

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
  const { textBases, beginTextEdit, getNoteText, endTextEdit, isTextEditOpen, rebaseTextEdit, onRemoteTextChange } = createTextEditApi(ctx);
  const { writeLocked, readPlainNote, isLocked, lockedNoteIds, getVault, lockNote, setVault, unlockNote, getFutureContent, getVaultMeta, setVaultMeta, observeVaultMeta, rekeyVault, setLockedWriteSink } = createVaultApi(ctx, textBases);
  const { projectFolders, projectLabels, projectPropDefs, upsertPropDef, deletePropDef, upsertFolder, patchFolder, removeFolder, addLabel, removeLabelEverywhere, renameLabelEverywhere } = createTaxonomyApi(ctx);
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

  /**
   * Wszystkie klucze bajtów w `imageStore`, do których odwołuje się jakakolwiek
   * notatka (także w Koszu) albo wpis dziennika z budowy: obrazy ORAZ załączniki. To wejście dla GC — blob
   * używany przez inną notatkę (ten sam hash) nigdy nie jest kandydatem.
   */
  function referencedImages(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
      for (const a of plainAttachments(y.get("attachments"))) refs.add(a.hash);
    });
    // Zdjęcia dziennika z budowy (Nauka) — te same bajty w `imageStore`.
    for (const r of journalRefsIn(doc)) refs.add(r);
    // Obrazy analiz planów (oryginał i kopia robocza).
    for (const r of planRefsIn(doc)) refs.add(r);
    // Zdjęcia dowodów długów (L4.3).
    for (const r of debtProofRefsIn(doc)) refs.add(r);
    return refs;
  }

  /** Obrazy i załączniki podanych notatek (Z-6.5: odnowienie karencji przy trwałym usunięciu). */
  function noteFileRefs(ids: readonly string[]): string[] {
    const refs = new Set<string>();
    for (const id of ids) {
      const y = notesMap.get(id);
      if (!y) continue;
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
      for (const a of plainAttachments(y.get("attachments"))) refs.add(a.hash);
    }
    return [...refs];
  }

  /** Załączniki wszystkich notatek: hash → manifest (rozmiar do limitu łącznego i backupu). */
  function referencedAttachments(): Map<string, Attachment> {
    const out = new Map<string, Attachment>();
    notesMap.forEach((y) => {
      for (const a of plainAttachments(y.get("attachments"))) if (!out.has(a.hash)) out.set(a.hash, a);
    });
    return out;
  }

  /**
   * Klucze, które wolno wysłać innemu urządzeniu (P2P, plik sync): wszystkie
   * obrazy (także zdjęcia dziennika z budowy) i załączniki do `ATTACHMENT_SYNC_MAX_BYTES`. Większe pliki są
   * lokalne dla urządzenia (UI mówi o tym wprost).
   */
  function syncableRefs(): Set<string> {
    const refs = new Set<string>();
    notesMap.forEach((y) => {
      const list = y.get("imageHashes");
      if (Array.isArray(list)) for (const r of list) if (typeof r === "string") refs.add(r);
    });
    referencedAttachments().forEach((a, hash) => { if (isAttachmentSyncable(a)) refs.add(hash); });
    for (const r of journalRefsIn(doc, true)) refs.add(r);
    // Plany: kopia robocza zawsze, oryginał tylko do 2 MB (D3).
    for (const r of planRefsIn(doc, true)) refs.add(r);
    // Dowody długów: po `prepareImage` (do 2 MB), więc jadą zawsze.
    for (const r of debtProofRefsIn(doc)) refs.add(r);
    return refs;
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

  /** Destructive full replace (used by "restore from backup file") — not a merge. */
  function replaceAll(notes: Note[], folders: Folder[], labels: string[], propDefs: PropDef[] = []): void {
    doc.transact(() => {
      notesMap.forEach((_v, k) => notesMap.delete(k));
      foldersMap.forEach((_v, k) => foldersMap.delete(k));
      labelsMap.forEach((_v, k) => labelsMap.delete(k));
      propDefsMap.forEach((_v, k) => propDefsMap.delete(k));
      for (const note of notes) notesMap.set(note.id, yNoteFromPlain(note));
      for (const folder of folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
      for (const label of labels) labelsMap.set(label, true);
      for (const def of cleanPropDefs(propDefs)) propDefsMap.set(def.id, yPropDefFromPlain(def));
    });
  }

  /**
   * Wymiana porcjami w toku (Z-16.2 p. 3). Pomiar: po każdej porcji React przerysowywał całą listę notatek
   * (do 500 ms przy 4× spowolnieniu), więc rzuty do interfejsu (`useNotes`) czekają na koniec i liczą się raz.
   * Wewnętrzny obserwator brudnych notatek działa dalej — końcowy rzut widzi wszystkie zmiany, też te z synchronizacji.
   */
  let bulkWrites = 0;
  const bulkEndListeners = new Set<() => void>();
  const isBulkWriting = () => bulkWrites > 0;
  function onBulkWriteEnd(fn: () => void): () => void {
    bulkEndListeners.add(fn);
    return () => { bulkEndListeners.delete(fn); };
  }

  /**
   * Wymiana notatek porcjami (Z-16.2, `docs/plan-dane-lokalne.md` §2.2) — przywracanie dużej kopii bez długiego zadania.
   * Każdy stan pośredni jest **nadzbiorem**: najpierw wstawianie (porcje po ok. `budgetMs`, między nimi oddanie wątku),
   * dopiero na końcu jedna transakcja z usunięciem notatek sprzed przywracania, których nie ma w kopii, i z wymianą
   * folderów, etykiet i pól. Notatka dodana w trakcie (lokalnie albo z synchronizacji) zostaje. Przerwanie (`signal`,
   * zamknięta karta) niczego nie usuwa. `final` wykonuje się w transakcji końcowej — tam idą metadane skarbca (P1).
   *
   * `budgetMs` to czas całej porcji razem z zamknięciem transakcji (kodowanie aktualizacji dla IndexedDB i kart,
   * obserwatorzy) — według pomiaru to ok. dwa razy więcej niż samo wstawianie. Czas wstawiania jest więc dobierany
   * po każdej porcji tak, żeby całość mieściła się w budżecie.
   */
  async function replaceAllChunked(
    notes: Note[], folders: Folder[], labels: string[], propDefs: PropDef[] = [],
    opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal; final?: () => void; budgetMs?: number } = {},
  ): Promise<void> {
    const budget = opts.budgetMs ?? 20;
    const before = new Set(notesMap.keys());
    const keepNotes = new Set(notes.map((n) => n.id));
    const defs = cleanPropDefs(propDefs);
    const aborted = () => { if (opts.signal?.aborted) throw new DOMException("Przerwano przywracanie", "AbortError"); };
    let insertBudget = budget / 3;
    let i = 0;
    let first = true;
    bulkWrites++;
    try {
      do {
        aborted();
        const t0 = performance.now();
        doc.transact(() => {
          if (first) {
            // Foldery, etykiety i pola dokładane od razu: wstawiane notatki mają do czego wskazywać.
            for (const folder of folders) foldersMap.set(folder.id, yFolderFromPlain(folder));
            for (const label of labels) labelsMap.set(label, true);
            for (const def of defs) propDefsMap.set(def.id, yPropDefFromPlain(def));
          }
          while (i < notes.length) {
            notesMap.set(notes[i].id, yNoteFromPlain(notes[i]));
            i++;
            if (performance.now() - t0 > insertBudget) break;
          }
        });
        const spent = performance.now() - t0;
        insertBudget = Math.min(budget, Math.max(budget > 0 ? 1 : 0, insertBudget * budget / Math.max(spent, 0.1)));
        first = false;
        opts.onProgress?.(i, notes.length);
        if (i < notes.length) await yieldToMain();
      } while (i < notes.length);
      aborted();
      const folderIds = new Set(folders.map((f) => f.id));
      const labelSet = new Set(labels);
      const defIds = new Set(defs.map((d) => d.id));
      doc.transact(() => {
        opts.final?.();
        for (const id of before) if (!keepNotes.has(id)) notesMap.delete(id);
        for (const k of [...foldersMap.keys()]) if (!folderIds.has(k)) foldersMap.delete(k);
        for (const k of [...labelsMap.keys()]) if (!labelSet.has(k)) labelsMap.delete(k);
        for (const k of [...propDefsMap.keys()]) if (!defIds.has(k)) propDefsMap.delete(k);
      });
    } finally {
      // Także po przerwaniu: interfejs ma pokazać nadzbiór, który został.
      if (--bulkWrites === 0) for (const fn of [...bulkEndListeners]) fn();
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
