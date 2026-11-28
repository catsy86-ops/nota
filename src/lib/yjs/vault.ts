import * as Y from "yjs";
import type { Note } from "@/lib/types/note";
import { type YChecklistItem, FUTURE_CONTENT_KEY, yChecklistFromPlain, PRIVATE_META, type PrivateFields, plainFromYNote } from "./codec";
import type { StoreCtx } from "./context";
import { RETIRED_PREFIX } from "@/lib/vault";
import type { TextBase } from "../yTextEdit";

/**
 * Notatki prywatne w dokumencie (F3, krok 4 — w planie krok 3): blokada i zdjęcie blokady, szyfrogramy, metadane
 * skarbca, zmiana klucza i ujście zapisów treści (`setLockedWriteSink`, ustawia je `privateNotes.ts`). Szyfruje
 * i odszyfrowuje `privateNotes.ts` — tu są tylko operacje na dokumencie. `textBases` z `textEdit.ts`: zablokowanie
 * kończy sesję edycji treści.
 */

export function createVaultApi(ctx: StoreCtx, textBases: Map<string, TextBase>) {
  const { doc, notesMap, vaultMap } = ctx;
  /** Odbiorca zapisów treści notatek prywatnych (ustawia `privateNotes.ts`). */
  let lockedWriteSink: ((id: string, fields: PrivateFields) => boolean) | null = null;

  /** Zapis pól treści notatki prywatnej przez ujście skarbca; `false`, gdy ujścia nie ma albo je odrzuciło. */
  function writeLocked(id: string, fields: PrivateFields): boolean {
    return lockedWriteSink?.(id, fields) ?? false;
  }

  /** Jawna, pełna notatka z dokumentu (dla skarbca przy blokowaniu). `null`, gdy nie ma albo jest już prywatna. */
  function readPlainNote(id: string): Note | null {
    const y = notesMap.get(id);
    if (!y || y.get("locked") === true) return null;
    return plainFromYNote(id, y);
  }

  function isLocked(id: string): boolean {
    return notesMap.get(id)?.get("locked") === true;
  }

  /** Id wszystkich notatek prywatnych (też w koszu i archiwum). */
  function lockedNoteIds(): string[] {
    const ids: string[] = [];
    notesMap.forEach((y, id) => { if (y.get("locked") === true && typeof y.get("vault") === "string") ids.push(id); });
    return ids;
  }

  function getVault(id: string): string | null {
    const y = notesMap.get(id);
    const v = y?.get("locked") === true ? y.get("vault") : undefined;
    return typeof v === "string" ? v : null;
  }

  /**
   * Zamienia notatkę w prywatną: jawne pola znikają z dokumentu (stary `Y.Text` i
   * mapa listy są zastępowane nowymi, więc ich zawartość zostaje odśmiecona),
   * zostaje szyfrogram. Jedna transakcja.
   */
  function lockNote(id: string, vault: string, dropMeta = false): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") === true) return false;
    doc.transact(() => {
      y.set("content", new Y.Text());
      y.set("title", "");
      y.set("labels", []);
      y.set("checklist", new Y.Map<YChecklistItem>());
      y.set("imageHashes", []);
      y.delete("attachments");
      // Metadane idą do szyfrogramu (krok 3): z dokumentu znikają jawne wartości.
      if (dropMeta) for (const f of PRIVATE_META) y.delete(f);
      // Pola z przyszłości wróciły do szyfrogramu (`privateNotes.lockNote`) — jawna kopia znika.
      y.delete(FUTURE_CONTENT_KEY);
      y.set("vault", vault);
      y.set("locked", true);
      y.set("updatedAt", Date.now());
    });
    textBases.delete(id);
    return true;
  }

  /** Nowy szyfrogram istniejącej notatki prywatnej. */
  function setVault(id: string, vault: string, touch = true): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") !== true) return false;
    doc.transact(() => {
      y.set("vault", vault);
      if (touch) y.set("updatedAt", Date.now());
    });
    return true;
  }

  /** Zdejmuje blokadę: jawna treść wraca do dokumentu, szyfrogram znika. */
  function unlockNote(id: string, plain: Pick<Note, "title" | "content" | "checklist" | "labels"> & Partial<Pick<Note, "color" | "folderId" | "parentId" | "icon">>, futureContent?: string): boolean {
    const y = notesMap.get(id);
    if (!y || y.get("locked") !== true) return false;
    doc.transact(() => {
      const text = new Y.Text();
      if (plain.content) text.insert(0, plain.content);
      y.set("content", text);
      y.set("title", plain.title);
      y.set("labels", plain.labels.slice());
      y.set("checklist", yChecklistFromPlain(plain.checklist));
      // Metadane z szyfrogramu wracają do dokumentu, ale tylko tam, gdzie dokument ich nie ma: wartość jawna
      // (zapisana przy zablokowanym skarbcu) jest świeższa niż ta z szyfrogramu. Starsze treści: zostają jak były.
      for (const f of PRIVATE_META) if (plain[f] !== undefined && y.get(f) === undefined) y.set(f, plain[f]);
      // Nieznane pola treści szyfrogramu (nowsza wersja) — poza projekcją `Note`, wracają przy ponownej blokadzie.
      if (futureContent) y.set(FUTURE_CONTENT_KEY, futureContent);
      y.delete("vault");
      y.delete("locked");
      y.set("updatedAt", Date.now());
    });
    return true;
  }

  /** Pola z przyszłości zachowane przy zdjęciu blokady (JSON) albo `null`. */
  function getFutureContent(id: string): string | null {
    const v = notesMap.get(id)?.get(FUTURE_CONTENT_KEY);
    return typeof v === "string" ? v : null;
  }

  function getVaultMeta(): unknown {
    return vaultMap.get("meta");
  }

  function setVaultMeta(meta: unknown): void {
    doc.transact(() => { vaultMap.set("meta", meta); });
  }

  /** K2: surowe wpisy łańcucha wycofanych kluczy (`retired:*`) — niezaufane, waliduje `cleanRetired`. */
  function getRetiredEntries(): [string, unknown][] {
    const out: [string, unknown][] = [];
    vaultMap.forEach((v, k) => { if (k.startsWith(RETIRED_PREFIX)) out.push([k, v]); });
    return out.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  function observeVaultMeta(listener: () => void): () => void {
    vaultMap.observe(listener);
    return () => vaultMap.unobserve(listener);
  }

  /**
   * Zmiana klucza skarbca: nowe metadane i nowe szyfrogramy wszystkich podanych
   * notatek w JEDNEJ transakcji — peer widzi albo stary stan, albo cały nowy.
   * Zwraca `false` (nic nie zapisuje), gdy któraś notatka zmieniła szyfrogram
   * od chwili, gdy go odczytano (`expected`), albo przestała być prywatna,
   * albo gdy bieżące metadane skarbca nie spełniają `metaUnchanged` (inne
   * urządzenie zmieniło nagłówek w trakcie — nie nadpisujemy go).
   */
  function rekeyVault(
    meta: unknown, next: Map<string, { expected: string; vault: string }>, metaUnchanged?: (current: unknown) => boolean, trash?: Map<string, string>,
    /**
     * K2: nowy łańcuch — każdy wpis pod swoim kluczem, klucze `retired:*` spoza zestawu usuwane. `expected` to
     * `new Map(getRetiredEntries())` z chwili odczytu: łańcuch zmieniony w trakcie przerywa zapis jak metadane.
     * Porównanie kluczy i referencji (Y.Map zwraca tę samą wartość, dopóki klucz nie zostanie nadpisany), bez
     * `JSON.stringify` — wartość `bigint` z dokumentu rzuciłaby i zablokowała każdą zmianę hasła.
     */
    retired?: { expected: Map<string, unknown>; entries: Map<string, unknown> },
  ): boolean {
    if (metaUnchanged && !metaUnchanged(vaultMap.get("meta"))) return false;
    if (retired) {
      const now = getRetiredEntries();
      if (now.length !== retired.expected.size || now.some(([k, v]) => !retired.expected.has(k) || retired.expected.get(k) !== v)) return false;
    }
    for (const [id, { expected }] of next) if (getVault(id) !== expected) return false;
    for (const [id, expected] of trash ?? []) if (getVault(id) !== expected) return false;
    doc.transact(() => {
      // Nieczytelne notatki idą do kosza ze starym szyfrogramem (da się go pobrać) — w tej samej transakcji.
      const t = Date.now();
      for (const id of trash?.keys() ?? []) {
        const y = notesMap.get(id)!;
        if (y.get("trashed") !== true) { y.set("trashed", true); y.set("trashedAt", t); }
      }
      for (const [id, { vault }] of next) notesMap.get(id)!.set("vault", vault);
      vaultMap.set("meta", meta);
      if (retired) {
        for (const [k] of getRetiredEntries()) if (!retired.entries.has(k)) vaultMap.delete(k);
        for (const [k, v] of retired.entries) vaultMap.set(k, v);
      }
    });
    return true;
  }

  function setLockedWriteSink(sink: typeof lockedWriteSink): void {
    lockedWriteSink = sink;
  }

  return { writeLocked, readPlainNote, isLocked, lockedNoteIds, getVault, lockNote, setVault, unlockNote, getFutureContent, getVaultMeta, setVaultMeta, getRetiredEntries, observeVaultMeta, rekeyVault, setLockedWriteSink };
}
