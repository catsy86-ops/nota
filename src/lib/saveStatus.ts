import { useSyncExternalStore } from "react";
import { logDiag } from "@/lib/diagnostics";

/**
 * Status zapisu na dysk (IndexedDB) i niezatwierdzonych szkiców.
 *
 * - `saving`  — są aktualizacje dokumentu, których transakcja IndexedDB jeszcze się nie zakończyła,
 * - `saved`   — ostatnia seria zapisów zakończona (pokazywane chwilę),
 * - `error`   — IndexedDB odrzuciło zapis; zmiany są tylko w pamięci karty.
 *
 * `dirtyDrafts` to liczba otwartych edytorów ze zmianami, których nie zatwierdzono do dokumentu.
 */
export type SavePhase = "idle" | "saving" | "saved" | "error";

export interface SaveStatus {
  phase: SavePhase;
  pendingWrites: number;
  dirtyDrafts: number;
}

/** Strukturalne typy — yjs / y-indexeddb wolno importować tylko w `yjsStore.ts`. */
interface DocLike {
  on(event: "update", fn: (update: Uint8Array, origin: unknown) => void): void;
}
interface PersistenceLike {
  db: { transaction(stores: string[], mode: "readwrite"): IDBTransaction } | null;
  whenSynced: Promise<unknown>;
}

const SAVED_VISIBLE_MS = 1600;

let state: SaveStatus = { phase: "idle", pendingWrites: 0, dirtyDrafts: 0 };
const listeners = new Set<() => void>();
const dirtyDraftIds = new Set<string>();
let savedTimer: ReturnType<typeof setTimeout> | null = null;

function emit(next: SaveStatus) {
  state = next;
  listeners.forEach((l) => l());
}

export function getSaveStatus(): SaveStatus {
  return state;
}

export function subscribeSaveStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
}

/** Czy zamknięcie karty teraz mogłoby zgubić zmiany. */
export function hasUnsavedWork(): boolean {
  return state.pendingWrites > 0 || state.dirtyDrafts > 0 || state.phase === "error";
}

/** Edytor zgłasza (lub cofa zgłoszenie), że ma zmiany niezatwierdzone do dokumentu. */
export function setDraftDirty(id: string, dirty: boolean) {
  if (dirty === dirtyDraftIds.has(id)) return;
  if (dirty) dirtyDraftIds.add(id);
  else dirtyDraftIds.delete(id);
  emit({ ...state, dirtyDrafts: dirtyDraftIds.size });
}

function writeStarted() {
  if (savedTimer) { clearTimeout(savedTimer); savedTimer = null; }
  emit({ ...state, phase: state.phase === "error" ? "error" : "saving", pendingWrites: state.pendingWrites + 1 });
}

function writeFinished(ok: boolean) {
  const pendingWrites = Math.max(0, state.pendingWrites - 1);
  if (!ok) {
    emit({ ...state, phase: "error", pendingWrites });
    return;
  }
  // Błąd jest „lepki”: nieudana aktualizacja przyrostowa nie trafi na dysk przy kolejnych
  // zapisach, więc stan wraca do normy dopiero po przeładowaniu karty.
  if (pendingWrites > 0 || state.phase === "error") {
    emit({ ...state, pendingWrites });
    return;
  }
  emit({ ...state, phase: "saved", pendingWrites: 0 });
  savedTimer = setTimeout(() => {
    savedTimer = null;
    if (state.phase === "saved") emit({ ...state, phase: "idle" });
  }, SAVED_VISIBLE_MS);
}

/**
 * Pusta transakcja zapisu na tym samym magazynie kończy się dopiero po wcześniejszych
 * (IndexedDB szereguje transakcje na magazynie), więc jej `oncomplete` znaczy „aktualizacje są na dysku”.
 */
function whenFlushed(persistence: PersistenceLike): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = persistence.db;
    if (!db) {
      persistence.whenSynced.then(() => resolve(), reject);
      return;
    }
    try {
      const tx = db.transaction(["updates"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB: błąd zapisu"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB: zapis przerwany"));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Podpina dokument pod status zapisu. `getPersistence` jest funkcją, bo store podmienia
 * obiekt persistence w testach (`resetForTests`).
 */
export function trackPersistence(doc: DocLike, getPersistence: () => PersistenceLike) {
  doc.on("update", (_update: Uint8Array, origin: unknown) => {
    const persistence = getPersistence();
    // Wczytanie z IndexedDB nie jest zapisem.
    if (origin === persistence) return;
    writeStarted();
    whenFlushed(persistence).then(
      () => writeFinished(true),
      (err) => {
        logDiag("error", "yjs", "zapis do IndexedDB nie powiódł się", err);
        writeFinished(false);
      },
    );
  });
}
