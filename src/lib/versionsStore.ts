import { keys as idbKeys, getMany as idbGetMany, set as idbSet, del as idbDel } from "idb-keyval";
import { logDiag } from "@/lib/diagnostics";

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  content: string;
  timestamp: number;
}

export const MAX_VERSIONS_PER_NOTE = 20;
/** Stary format: jedna tablica wszystkich wersji w localStorage (limit ~5 MB). */
export const LEGACY_VERSIONS_KEY = "kaczy-notes-versions";

/**
 * Historia wersji w IndexedDB, **jeden klucz na notatkę** — zapis wersji
 * jednej notatki nie przepisuje wszystkich, a brak miejsca w localStorage
 * przestaje być problemem. Świadomie poza `Y.Doc`: wersje nie idą przez
 * WebRTC (ten sam argument co przy obrazach).
 *
 * Odczyt jest synchroniczny z pamięci (`get`), bo karta pyta o wersje
 * w trakcie renderu; zapisy idą w tle, po kolei.
 */
export function createVersionsStore(prefix = "kaczy.versions.") {
  let byNote = new Map<string, NoteVersion[]>();
  let tick = 0;
  const listeners = new Set<() => void>();
  let writeChain: Promise<void> = Promise.resolve();
  let loadPromise: Promise<void> | null = null;

  function emit() {
    tick++;
    listeners.forEach((l) => l());
  }

  function persist(noteId: string) {
    const list = byNote.get(noteId);
    writeChain = writeChain.then(async () => {
      try {
        if (list?.length) await idbSet(prefix + noteId, list);
        else await idbDel(prefix + noteId);
      } catch (err) {
        logDiag("error", "versionsStore", `cannot persist versions (${list?.length ?? 0})`, err);
      }
    });
  }

  function newestFirst(list: NoteVersion[]): NoteVersion[] {
    return [...list].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_VERSIONS_PER_NOTE);
  }

  /** Wczytanie z IndexedDB + jednorazowa migracja z localStorage. */
  function load(): Promise<void> {
    loadPromise ??= (async () => {
      const loaded = new Map<string, NoteVersion[]>();
      try {
        const ks = (await idbKeys()).filter((k): k is string => typeof k === "string" && k.startsWith(prefix));
        const values = await idbGetMany<NoteVersion[]>(ks);
        ks.forEach((k, i) => { if (values[i]?.length) loaded.set(k.slice(prefix.length), values[i]); });
      } catch (err) {
        logDiag("error", "versionsStore", "cannot load versions", err);
      }

      let legacy: NoteVersion[] = [];
      try { legacy = JSON.parse(localStorage.getItem(LEGACY_VERSIONS_KEY) || "[]"); } catch { /* uszkodzone — pomijamy */ }
      const migrated = new Set<string>();
      for (const v of Array.isArray(legacy) ? legacy : []) {
        if (!v?.noteId) continue;
        const list = loaded.get(v.noteId) ?? [];
        if (!list.some((x) => x.id === v.id)) list.push(v);
        loaded.set(v.noteId, list);
        migrated.add(v.noteId);
      }

      // Zapisy zrobione przed wczytaniem (rzadkie) doklejamy do wczytanych.
      for (const [id, list] of byNote) {
        const base = loaded.get(id) ?? [];
        loaded.set(id, [...list, ...base.filter((b) => !list.some((x) => x.id === b.id))]);
        migrated.add(id);
      }
      for (const [id, list] of loaded) loaded.set(id, newestFirst(list));
      byNote = loaded;
      migrated.forEach(persist);
      // Stary klucz kasujemy dopiero po zapisie — przerwana migracja powtórzy się.
      if (legacy.length) {
        writeChain = writeChain.then(() => { try { localStorage.removeItem(LEGACY_VERSIONS_KEY); } catch { /* ignore */ } });
      }
      emit();
    })();
    return loadPromise;
  }

  function get(noteId: string): NoteVersion[] {
    return byNote.get(noteId) ?? [];
  }

  function add(noteId: string, title: string, content: string): void {
    const list = get(noteId);
    if (list[0] && list[0].title === title && list[0].content === content) return;
    const version: NoteVersion = { id: crypto.randomUUID(), noteId, title, content, timestamp: Date.now() };
    byNote.set(noteId, [version, ...list].slice(0, MAX_VERSIONS_PER_NOTE));
    persist(noteId);
    emit();
  }

  function remove(noteIds: string | string[]): void {
    const ids = (Array.isArray(noteIds) ? noteIds : [noteIds]).filter((id) => byNote.has(id));
    if (!ids.length) return;
    ids.forEach((id) => { byNote.delete(id); persist(id); });
    emit();
  }

  function all(): NoteVersion[] {
    return [...byNote.values()].flat();
  }

  /** Przywrócenie z backupu: zastępuje całą historię. */
  function replaceAll(versions: NoteVersion[]): void {
    const next = new Map<string, NoteVersion[]>();
    for (const v of versions) next.set(v.noteId, [...(next.get(v.noteId) ?? []), v]);
    for (const [id, list] of next) next.set(id, newestFirst(list));
    const touched = new Set([...byNote.keys(), ...next.keys()]);
    byNote = next;
    touched.forEach(persist);
    emit();
  }

  return {
    load, get, add, remove, all, replaceAll,
    subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
    getTick: () => tick,
    /** Test-only. */
    flush: () => writeChain,
  };
}

export type VersionsStore = ReturnType<typeof createVersionsStore>;
export const versionsStore = createVersionsStore();
