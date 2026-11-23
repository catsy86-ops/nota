import { yieldToMain } from "@/lib/yieldToMain";
import type { Note, Folder } from "@/lib/types/note";
import { cleanPropDefs, type PropDef } from "@/lib/noteProps";
import { yPropDefFromPlain, yNoteFromPlain, yFolderFromPlain } from "./codec";
import type { StoreCtx } from "./context";

/**
 * Wymiana całej zawartości dokumentu przy przywracaniu kopii (F3): od razu (`replaceAll`) albo porcjami bez
 * długiego zadania (`replaceAllChunked`), z licznikiem zapisów masowych, na który czeka projekcja w `useNotes`.
 */

export function createBulkReplaceApi(ctx: StoreCtx) {
  const { doc, notesMap, foldersMap, labelsMap, propDefsMap } = ctx;

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

  return { replaceAll, isBulkWriting, onBulkWriteEnd, replaceAllChunked };
}
