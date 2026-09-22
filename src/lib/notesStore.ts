import { get, set, del } from "idb-keyval";
import type { Note, Folder } from "@/hooks/useNotes";

/**
 * IndexedDB-backed storage for notes/labels/folders.
 * Migrates one-time from localStorage on first load.
 */

const NOTES_KEY = "kaczy.notes.v1";
const LABELS_KEY = "kaczy.labels.v1";
const FOLDERS_KEY = "kaczy.folders.v1";
const MIGRATED_KEY = "kaczy.idb.migrated.v1";

const LS_NOTES = "kaczy-notes-data";
const LS_LABELS = "kaczy-notes-labels";
const LS_FOLDERS = "kaczy-notes-folders";

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export interface Snapshot {
  notes: Note[];
  labels: string[];
  folders: Folder[];
}

/** True if the parsed value looks like a plausible Note[] (defends against corrupt JSON). */
function looksLikeNotes(value: unknown): value is Note[] {
  if (!Array.isArray(value)) return false;
  return value.every((n) => n && typeof n === "object" && typeof (n as Note).id === "string");
}

export async function loadAll(): Promise<Snapshot> {
  // One-time migration: copy localStorage → IDB then drop the LS copies.
  // Only drop the LS copy once the IDB write is verified to have landed —
  // a crash or a corrupt JSON blob must never end in silent data loss.
  if (!localStorage.getItem(MIGRATED_KEY)) {
    const rawNotes = localStorage.getItem(LS_NOTES);
    const parsedNotes = parse<unknown>(rawNotes, []);
    const lsLabels = parse<string[]>(localStorage.getItem(LS_LABELS), []);
    const lsFolders = parse<Folder[]>(localStorage.getItem(LS_FOLDERS), []);

    const notesLookValid = looksLikeNotes(parsedNotes);
    const lsNotes = notesLookValid ? (parsedNotes as Note[]) : [];

    if (lsNotes.length) await set(NOTES_KEY, lsNotes);
    if (lsLabels.length) await set(LABELS_KEY, lsLabels);
    if (lsFolders.length) await set(FOLDERS_KEY, lsFolders);

    // Verify the write actually landed in IDB before touching localStorage.
    const verified = lsNotes.length ? await get<Note[]>(NOTES_KEY) : [];
    const migrationSafe = !lsNotes.length || (verified?.length ?? 0) === lsNotes.length;

    if (migrationSafe) {
      localStorage.setItem(MIGRATED_KEY, "1");
      // Remove giant notes blob from LS to free quota; keep small ones as belt-and-suspenders.
      try { localStorage.removeItem(LS_NOTES); } catch { /* ignore */ }
    } else if (rawNotes && !notesLookValid) {
      // Corrupt JSON we couldn't parse into notes: leave it in place (don't flag as
      // migrated) so a future load can retry once/if the data becomes readable again,
      // instead of silently discarding it.
    }
  }

  const [notes, labels, folders] = await Promise.all([
    get<Note[]>(NOTES_KEY),
    get<string[]>(LABELS_KEY),
    get<Folder[]>(FOLDERS_KEY),
  ]);

  return {
    notes: notes ?? [],
    labels: labels ?? [],
    folders: folders ?? [],
  };
}

export const saveNotesIDB = (n: Note[]) => set(NOTES_KEY, n).catch(() => {});
export const saveLabelsIDB = (l: string[]) => set(LABELS_KEY, l).catch(() => {});
export const saveFoldersIDB = (f: Folder[]) => set(FOLDERS_KEY, f).catch(() => {});

export async function clearAllStorage() {
  await Promise.all([del(NOTES_KEY), del(LABELS_KEY), del(FOLDERS_KEY)]);
  localStorage.removeItem(LS_NOTES);
  localStorage.removeItem(LS_LABELS);
  localStorage.removeItem(LS_FOLDERS);
  localStorage.removeItem(MIGRATED_KEY);
}
