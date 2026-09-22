import { useSyncExternalStore } from "react";

export type ActionKind = "trash" | "archive";

export interface ActionEntry {
  id: string;
  kind: ActionKind;
  /** short label, e.g. note title or "3 notatki" */
  label: string;
  /** number of notes affected */
  count: number;
  /** short snippet of the note content shown in the history panel */
  preview?: string;
  /** ids of affected notes — used to rebuild undo after a page reload */
  noteIds: string[];
  at: number;
  undone: boolean;
  /** in-session undo closure (not persisted) */
  undo?: () => void;
}

const MAX = 20;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // keep a week of history
const STORAGE_KEY = "recent-actions";

/** Undo fallbacks used when the original closure is gone (after reload). */
type UndoHandlers = Partial<Record<ActionKind, (noteIds: string[]) => void>>;
let handlers: UndoHandlers = {};

export function registerUndoHandlers(h: UndoHandlers) {
  handlers = { ...handlers, ...h };
}

let entries: ActionEntry[] = load();
const listeners = new Set<() => void>();

function load(): ActionEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter(
        (e): e is ActionEntry =>
          !!e &&
          typeof e.id === "string" &&
          (e.kind === "trash" || e.kind === "archive") &&
          typeof e.at === "number" &&
          now - e.at < MAX_AGE,
      )
      .map((e) => ({
        ...e,
        label: typeof e.label === "string" ? e.label : "Notatka",
        count: typeof e.count === "number" ? e.count : 1,
        noteIds: Array.isArray(e.noteIds) ? e.noteIds : [],
        preview: typeof e.preview === "string" ? e.preview : undefined,
        undone: !!e.undone,
        undo: undefined,
      }))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.map(({ undo, ...rest }) => rest)),
    );
  } catch {
    /* quota / private mode — history stays in-memory */
  }
}

function emit() {
  entries = [...entries];
  persist();
  listeners.forEach((l) => l());
}

export function pushAction(
  entry: Omit<ActionEntry, "id" | "at" | "undone" | "noteIds"> & { noteIds?: string[] },
) {
  entries = [
    { noteIds: [], ...entry, id: crypto.randomUUID(), at: Date.now(), undone: false },
    ...entries,
  ].slice(0, MAX);
  emit();
}

export function undoAction(id: string) {
  const entry = entries.find((e) => e.id === id);
  if (!entry || entry.undone) return false;
  const fallback = handlers[entry.kind];
  const run = entry.undo ?? (entry.noteIds.length && fallback ? () => fallback(entry.noteIds) : null);
  if (!run) return false;
  try {
    run();
  } catch {
    return false;
  }
  entries = entries.map((e) => (e.id === id ? { ...e, undone: true } : e));
  emit();
  return true;
}

/** Undo the most recent still-undoable entry. Returns its label, or null. */
export function undoLastAction(): { label: string; kind: ActionKind } | null {
  const entry = entries.find((e) => canUndo(e));
  if (!entry) return null;
  return undoAction(entry.id) ? { label: entry.label, kind: entry.kind } : null;
}

export function canUndo(entry: ActionEntry) {
  return !entry.undone && (!!entry.undo || (entry.noteIds.length > 0 && !!handlers[entry.kind]));
}

export function clearActions() {
  entries = [];
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const EMPTY: ActionEntry[] = [];

export function useActionHistory(): ActionEntry[] {
  return useSyncExternalStore(subscribe, () => entries, () => EMPTY);
}

export function relativeTime(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 10) return "przed chwilą";
  if (s < 60) return `${s} s temu`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} godz. temu`;
  return `${Math.round(h / 24)} dni temu`;
}
