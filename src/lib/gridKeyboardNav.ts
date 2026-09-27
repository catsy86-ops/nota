import { useSyncExternalStore } from "react";

/**
 * Nawigacja klawiaturą po siatce notatek — jeden właściciel na całą stronę.
 *
 * Wcześniej każdy `NoteGrid` rejestrował własny `window.addEventListener("keydown")`
 * z lokalnym `focusedIdx`. Widok „Notatki” renderuje jednak dwie siatki
 * („Przypięte” i „Inne”), więc każdy klawisz był obsługiwany dwa razy: strzałka
 * podświetlała dwie notatki, Enter otwierał dwa edytory, a `Delete` wyrzucał do
 * kosza dwie notatki. Tutaj stan fokusu i podglądu jest globalny, a sekcje
 * (siatki) tylko zgłaszają swoje notatki i akcje — strzałki przechodzą więc
 * płynnie z przypiętych do pozostałych, jak po jednej liście.
 */

export interface GridNavHandlers {
  onDelete: (id: string) => void;
  onArchive?: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  /** Otwiera edytor notatki (klika kafel). */
  openNote: (id: string) => void;
  /** Przewija kafel do widoku. */
  scrollToNote: (id: string) => void;
  /** Liczba kolumn w tej sekcji — decyduje o skoku dla ↑/↓. */
  colsCount: () => number;
}

interface Section {
  order: number;
  seq: number;
  noteIds: string[];
  handlers: GridNavHandlers;
}

interface NavState {
  focusedId: string | null;
  previewId: string | null;
}

const sections = new Set<Section>();
let state: NavState = { focusedId: null, previewId: null };
const listeners = new Set<() => void>();
let previewScrollEl: HTMLElement | null = null;
let keyListenerAttached = false;
let seqCounter = 0;

function emit() {
  for (const l of listeners) l();
}

function setState(next: Partial<NavState>) {
  const merged = { ...state, ...next };
  if (merged.focusedId === state.focusedId && merged.previewId === state.previewId) return;
  state = merged;
  emit();
}

function orderedSections(): Section[] {
  return [...sections].sort((a, b) => a.order - b.order || a.seq - b.seq);
}

/** Wszystkie notatki wszystkich sekcji jako jedna lista w kolejności widoku. */
function flatIds(): string[] {
  return orderedSections().flatMap((s) => s.noteIds);
}

function sectionOf(id: string): Section | undefined {
  return orderedSections().find((s) => s.noteIds.includes(id));
}

export function registerGridNavSection(order: number, noteIds: string[], handlers: GridNavHandlers): () => void {
  const section: Section = { order, seq: seqCounter++, noteIds, handlers };
  sections.add(section);
  attachKeyListener();
  return () => {
    sections.delete(section);
    // Fokus na notatce, której już nie ma, zostawiłby martwy pierścień.
    const ids = flatIds();
    if (state.focusedId && !ids.includes(state.focusedId)) setState({ focusedId: null });
    if (state.previewId && !ids.includes(state.previewId)) setState({ previewId: null });
    if (sections.size === 0) detachKeyListener();
  };
}

export function setGridNavFocus(id: string | null) {
  setState({ focusedId: id });
}

export function setGridNavPreview(id: string | null) {
  setState({ previewId: id });
}

export function setGridNavPreviewScrollEl(el: HTMLElement | null) {
  previewScrollEl = el;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot() {
  return state;
}

export function useGridNavState(): NavState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- obsługa klawiatury ---

function isTyping() {
  const a = document.activeElement as HTMLElement | null;
  if (!a) return false;
  const tag = a.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable;
}

function anyDialogOpen() {
  return !!document.querySelector('[role="dialog"][data-state="open"]');
}

function handlePreviewKeys(e: KeyboardEvent, previewId: string) {
  if (e.key === "Escape" || e.key === " ") {
    e.preventDefault();
    setGridNavPreview(null);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const section = sectionOf(previewId);
    setGridNavPreview(null);
    // Kafel musi najpierw wrócić na wierzch po zamknięciu podglądu.
    setTimeout(() => section?.handlers.openNote(previewId), 50);
    return;
  }
  const sc = previewScrollEl;
  if (!sc) return;
  const step = 80;
  switch (e.key) {
    case "ArrowDown":
    case "j": e.preventDefault(); sc.scrollBy({ top: step, behavior: "smooth" }); return;
    case "ArrowUp":
    case "k": e.preventDefault(); sc.scrollBy({ top: -step, behavior: "smooth" }); return;
    case "PageDown": e.preventDefault(); sc.scrollBy({ top: sc.clientHeight * 0.9, behavior: "smooth" }); return;
    case "PageUp": e.preventDefault(); sc.scrollBy({ top: -sc.clientHeight * 0.9, behavior: "smooth" }); return;
    case "Home": e.preventDefault(); sc.scrollTo({ top: 0, behavior: "smooth" }); return;
    case "End": e.preventDefault(); sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" }); return;
    default: return;
  }
}

export function handleGridNavKey(e: KeyboardEvent) {
  if (e.key === "/" && !isTyping() && !anyDialogOpen()) {
    const input = document.querySelector<HTMLInputElement>('input[placeholder="Szukaj notatek..."]');
    if (input) { e.preventDefault(); input.focus(); input.select(); return; }
  }
  const ids = flatIds();
  if (ids.length === 0) return;
  if (isTyping()) return;

  if (state.previewId) {
    handlePreviewKeys(e, state.previewId);
    return;
  }
  if (anyDialogOpen()) return;

  const focusedId = state.focusedId;
  const hasFocus = focusedId !== null && ids.includes(focusedId);
  const curIdx = hasFocus ? ids.indexOf(focusedId as string) : 0;
  const section = hasFocus ? sectionOf(focusedId as string) : orderedSections()[0];
  const cols = section?.handlers.colsCount() ?? 1;

  let next = curIdx;
  switch (e.key) {
    case "ArrowRight": next = Math.min(ids.length - 1, curIdx + 1); break;
    case "ArrowLeft": next = Math.max(0, curIdx - 1); break;
    case "ArrowDown": next = Math.min(ids.length - 1, curIdx + cols); break;
    case "ArrowUp": next = Math.max(0, curIdx - cols); break;
    case "Home": next = 0; break;
    case "End": next = ids.length - 1; break;
    case " ":
      if (hasFocus) { e.preventDefault(); setGridNavPreview(focusedId); }
      return;
    case "Enter":
      if (hasFocus) { e.preventDefault(); section?.handlers.openNote(focusedId as string); }
      return;
    case "Delete":
    case "Backspace":
      if (hasFocus) { e.preventDefault(); section?.handlers.onDelete(focusedId as string); }
      return;
    case "a":
    case "A":
      if (hasFocus && section?.handlers.onArchive) { e.preventDefault(); section.handlers.onArchive(focusedId as string); }
      return;
    case "p":
    case "P":
      if (hasFocus && section?.handlers.onTogglePin) { e.preventDefault(); section.handlers.onTogglePin(focusedId as string); }
      return;
    case "d":
    case "D":
      if (hasFocus && section?.handlers.onDuplicate) { e.preventDefault(); section.handlers.onDuplicate(focusedId as string); }
      return;
    default: return;
  }
  e.preventDefault();
  const nextId = ids[next];
  setGridNavFocus(nextId);
  sectionOf(nextId)?.handlers.scrollToNote(nextId);
}

function attachKeyListener() {
  if (keyListenerAttached || typeof window === "undefined") return;
  window.addEventListener("keydown", handleGridNavKey);
  keyListenerAttached = true;
}

function detachKeyListener() {
  if (!keyListenerAttached || typeof window === "undefined") return;
  window.removeEventListener("keydown", handleGridNavKey);
  keyListenerAttached = false;
}

/** Tylko dla testów — czyści globalny stan między przypadkami. */
export function __resetGridNavForTests() {
  sections.clear();
  state = { focusedId: null, previewId: null };
  previewScrollEl = null;
  seqCounter = 0;
  detachKeyListener();
}
