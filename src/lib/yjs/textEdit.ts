import * as Y from "yjs";
import { applyTextEdit, captureTextBase, mapOffset, type TextBase } from "../yTextEdit";
import type { StoreCtx } from "./context";

/**
 * Sesje edycji treści notatki (F3, krok 3 — w planie krok 4): baza, którą widział edytor, scalanie szkicu ze
 * zmianami peera i żywy `Y.Text` dla CM. `textBases` jest wewnętrzne — korzysta z niego zapis treści
 * (`applyPatch`) i blokowanie notatki w skarbcu.
 */

export function createTextEditApi(ctx: StoreCtx) {
  const { doc, notesMap } = ctx;
  /** Otwarte sesje edycji: baza, którą widział edytor danej notatki. */
  const textBases = new Map<string, TextBase>();

  /**
   * Edytor otwiera sesję, zanim użytkownik zacznie pisać: zapamiętujemy treść
   * i tożsamości znaków, które widzi. Zapisy treści tej notatki idą potem
   * względem tej bazy, więc zmiany peera z czasu edycji nie są kasowane.
   * Zwraca treść bazy — to ona powinna trafić do pola edycji.
   */
  function beginTextEdit(id: string): string | null {
    if (notesMap.get(id)?.get("locked") === true) return null;
    const text = notesMap.get(id)?.get("content");
    if (!(text instanceof Y.Text)) return null;
    const base = captureTextBase(text);
    textBases.set(id, base);
    return base.text;
  }

  /**
   * Żywy `Y.Text` treści notatki dla edytora CM, który wiąże się z dokumentem (plan Fazy 1b).
   * `null` dla notatek prywatnych (szyfrogram, brak `Y.Text`) — one zostają przy zapisie przez sesję.
   */
  function getNoteText(id: string): Y.Text | null {
    if (notesMap.get(id)?.get("locked") === true) return null;
    const text = notesMap.get(id)?.get("content");
    return text instanceof Y.Text ? text : null;
  }

  function endTextEdit(id: string): void {
    textBases.delete(id);
  }

  /** Czy edytor tej notatki jest teraz otwarty (trwa sesja edycji treści). */
  function isTextEditOpen(id: string): boolean {
    return textBases.has(id);
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

  return { textBases, beginTextEdit, getNoteText, endTextEdit, isTextEditOpen, rebaseTextEdit, onRemoteTextChange };
}
