import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { versionsStore } from "@/lib/versionsStore";
import type { NotePriority } from "@/lib/notePriority";

export type NoteColor = "default" | "coral" | "peach" | "sand" | "mint" | "sage" | "sky" | "lavender" | "rose";

export type FolderColor = "default" | "coral" | "peach" | "sand" | "mint" | "sage" | "sky" | "lavender" | "rose";

export interface Folder {
  id: string;
  name: string;
  color: FolderColor;
  emoji: string | null;
  parentId: string | null;
  order: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  pinned: boolean;
  archived: boolean;
  trashed: boolean;
  trashedAt: number | null;
  labels: string[];
  reminder: number | null;
  reminderRepeat?: "none" | "daily" | "weekly" | "monthly";
  priority: NotePriority;
  /** Notatka dnia: lokalna data `YYYY-MM-DD` (patrz `lib/dailyNote.ts`); brak = zwykła notatka. */
  dailyDate?: string;
  images: string[]; // base64 data URLs — kept device-local, not synced via Yjs
  checklist: ChecklistItem[];
  folderId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Get all descendant folder IDs (recursive) */
export function getDescendantFolderIds(folderId: string, folders: Folder[]): string[] {
  const children = folders.filter((f) => f.parentId === folderId);
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    ids.push(...getDescendantFolderIds(child.id, folders));
  }
  return ids;
}

export function useNotes() {
  // Notes/folders/labels live in a Yjs doc (persisted via y-indexeddb); this
  // React state is a projection of it, kept in sync via observeDeep. See
  // src/lib/yjsStore.ts for the data layer and its one-time migration from
  // the previous idb-keyval store (src/lib/notesStore.ts).
  const [notes, setNotes] = useState<Note[]>([]);
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const foldersRef = useRef<Folder[]>(folders);
  foldersRef.current = folders;

  useEffect(() => {
    let cancelled = false;

    // Każda mapa ma własnego obserwatora: zmiana notatki nie przelicza
    // folderów i etykiet (i odwrotnie). Tablica notatek zmienia tożsamość
    // tylko wtedy, gdy zmieniła się któraś notatka albo ich kolejność.
    function projectNotes() {
      const next = yjsStore.projectNotes();
      setNotes((prev) => (prev.length === next.length && prev.every((n, i) => n === next[i]) ? prev : next));
    }
    const projectFolders = () => setFolders(yjsStore.projectFolders());
    const projectLabels = () => setAllLabels(yjsStore.projectLabels());

    yjsStore.notesMap.observeDeep(projectNotes);
    yjsStore.foldersMap.observeDeep(projectFolders);
    yjsStore.labelsMap.observeDeep(projectLabels);
    const offLocal = yjsStore.onLocalChange(projectNotes);

    yjsStore.ready().then(() => {
      if (cancelled) return;
      projectNotes();
      projectFolders();
      projectLabels();
    });

    return () => {
      cancelled = true;
      yjsStore.notesMap.unobserveDeep(projectNotes);
      yjsStore.foldersMap.unobserveDeep(projectFolders);
      yjsStore.labelsMap.unobserveDeep(projectLabels);
      offLocal();
    };
  }, []);

  // Auto-cleanup: remove notes trashed more than 30 days ago. `removeNotes`
  // uses a real Y.Map delete (tombstone), same path every other delete uses,
  // so this stays sync-safe once a network transport is added later.
  useEffect(() => {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const expired = notes.filter((n) => n.trashed && n.trashedAt && now - n.trashedAt > THIRTY_DAYS).map((n) => n.id);
    if (expired.length) { yjsStore.removeNotes(expired); versionsStore.remove(expired); }
  }, [notes]);

  /** Zwraca id utworzonej notatki — potrzebne, gdy wywołujący musi ją zaraz dopatchować. */
  const addNote = useCallback((title: string, content: string, color: NoteColor = "default", labels: string[] = [], reminder: number | null = null, images: string[] = [], checklist: ChecklistItem[] = [], priority: NotePriority = "none", folderId: string | null = null): string => {
    const now = Date.now();
    const note: Note = { id: crypto.randomUUID(), title, content, color, pinned: false, archived: false, trashed: false, trashedAt: null, labels, reminder, priority, images, checklist, folderId, order: 0, createdAt: now, updatedAt: now };
    yjsStore.upsertNote(note);
    return note.id;
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => {
    yjsStore.patchNote(id, updates);
  }, []);

  const deleteNote = useCallback((id: string) => {
    yjsStore.removeNote(id);
  }, []);

  const trashNote = useCallback((id: string) => {
    yjsStore.patchNote(id, { trashed: true, trashedAt: Date.now(), pinned: false, archived: false });
  }, []);

  const restoreFromTrash = useCallback((id: string) => {
    yjsStore.patchNote(id, { trashed: false, trashedAt: null });
  }, []);

  const emptyTrash = useCallback(() => {
    const trashedIds = yjsStore.projectNotes().filter((n) => n.trashed).map((n) => n.id);
    if (trashedIds.length) yjsStore.removeNotes(trashedIds);
  }, []);

  const togglePin = useCallback((id: string) => {
    const current = yjsStore.projectNotes().find((n) => n.id === id);
    if (!current) return;
    yjsStore.patchNote(id, { pinned: !current.pinned });
  }, []);

  const duplicateNote = useCallback((id: string) => {
    const original = yjsStore.projectNotes().find((n) => n.id === id);
    if (!original) return;
    const now = Date.now();
    // Kopia notatki dnia jest zwykłą notatką — inaczej byłyby dwie „notatki dnia” na ten sam dzień.
    const { dailyDate: _daily, ...rest } = original;
    const copy: Note = { ...rest, id: crypto.randomUUID(), title: original.title ? `${original.title} (kopia)` : "", pinned: false, createdAt: now, updatedAt: now };
    yjsStore.upsertNote(copy);
  }, []);

  const archiveNote = useCallback((id: string) => {
    yjsStore.patchNote(id, { archived: true, pinned: false });
  }, []);

  const unarchiveNote = useCallback((id: string) => {
    yjsStore.patchNote(id, { archived: false });
  }, []);

  const addLabel = useCallback((label: string) => {
    yjsStore.addLabel(label);
  }, []);

  const removeLabel = useCallback((label: string) => {
    yjsStore.removeLabelEverywhere(label);
  }, []);

  const renameLabel = useCallback((oldLabel: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;
    yjsStore.renameLabelEverywhere(oldLabel, trimmed);
  }, []);

  const importNotes = useCallback((imported: Note[]) => {
    const existingIds = new Set(yjsStore.projectNotes().map((n) => n.id));
    for (const note of imported) {
      if (!existingIds.has(note.id)) yjsStore.upsertNote(note);
    }
    const importedLabels = new Set(imported.flatMap((n) => n.labels));
    importedLabels.forEach((l) => yjsStore.addLabel(l));
  }, []);

  const reorderNotes = useCallback((activeIds: string[]) => {
    // Persists the dropped order as `order` on each note; only read back when
    // the user has sortKey "manual" selected (see useFilteredNotes.ts).
    yjsStore.setNoteOrder(activeIds);
  }, []);

  // Folder operations
  const addFolder = useCallback((name: string, parentId: string | null = null, color: FolderColor = "default") => {
    const now = Date.now();
    const folder: Folder = { id: crypto.randomUUID(), name: name.trim(), color, emoji: null, parentId, order: 0, createdAt: now, updatedAt: now };
    yjsStore.upsertFolder(folder);
    return folder.id;
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Omit<Folder, "id" | "createdAt">>) => {
    yjsStore.patchFolder(id, updates);
  }, []);

  const deleteFolder = useCallback((id: string) => {
    const descendantIds = getDescendantFolderIds(id, foldersRef.current);
    const allRemoved = new Set([id, ...descendantIds]);
    allRemoved.forEach((folderId) => yjsStore.removeFolder(folderId));
    const affectedNoteIds = yjsStore.projectNotes().filter((n) => n.folderId && allRemoved.has(n.folderId)).map((n) => n.id);
    if (affectedNoteIds.length) yjsStore.patchNotes(affectedNoteIds, { folderId: null });
  }, []);

  const moveNoteToFolder = useCallback((noteId: string, folderId: string | null) => {
    yjsStore.patchNote(noteId, { folderId });
  }, []);

  const activeNotes = useMemo(() => notes.filter((n) => !n.archived && !n.trashed).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  }), [notes]);

  const archivedNotes = useMemo(() => notes.filter((n) => n.archived && !n.trashed).sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  const trashedNotes = useMemo(() => notes.filter((n) => n.trashed).sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  const bulkTrash = useCallback((ids: string[]) => {
    yjsStore.patchNotes(ids, { trashed: true, trashedAt: Date.now(), pinned: false, archived: false });
  }, []);
  const bulkArchive = useCallback((ids: string[]) => {
    yjsStore.patchNotes(ids, { archived: true, pinned: false });
  }, []);
  const bulkSetColor = useCallback((ids: string[], color: NoteColor) => {
    yjsStore.patchNotes(ids, { color });
  }, []);
  const bulkRestore = useCallback((ids: string[]) => {
    yjsStore.patchNotes(ids, { trashed: false, trashedAt: null, archived: false });
  }, []);

  const actions = useMemo(() => ({ addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote, archiveNote, unarchiveNote, addLabel, removeLabel, renameLabel, importNotes, reorderNotes, addFolder, updateFolder, deleteFolder, moveNoteToFolder, bulkTrash, bulkArchive, bulkSetColor, bulkRestore }),
    [addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote, archiveNote, unarchiveNote, addLabel, removeLabel, renameLabel, importNotes, reorderNotes, addFolder, updateFolder, deleteFolder, moveNoteToFolder, bulkTrash, bulkArchive, bulkSetColor, bulkRestore]);

  return useMemo(() => ({ notes: activeNotes, archivedNotes, trashedNotes, allLabels, folders, ...actions }),
    [activeNotes, archivedNotes, trashedNotes, allLabels, folders, actions]);
}

/**
 * Sesja edycji treści notatki (patrz `yjsStore.beginTextEdit`). Zwraca treść,
 * od której edytor ma zacząć — zapisy w trakcie sesji nie nadpiszą tego, co
 * w międzyczasie dopisał inny peer.
 */
export function beginNoteTextEdit(id: string): string | null {
  return yjsStore.beginTextEdit(id);
}

export function endNoteTextEdit(id: string): void {
  yjsStore.endTextEdit(id);
}

export function isNoteTextEditOpen(id: string): boolean {
  return yjsStore.isTextEditOpen(id);
}

/** Scala szkic ze zmianami peera i zwraca tekst do pokazania + przeliczone zaznaczenie. */
export function rebaseNoteTextEdit(id: string, draft: string, selection: [number, number]) {
  return yjsStore.rebaseTextEdit(id, draft, selection);
}

export function onRemoteNoteTextChange(id: string, listener: () => void): () => void {
  return yjsStore.onRemoteTextChange(id, listener);
}

/** Rozwiązuje się, gdy dokument jest wczytany z IndexedDB (i po migracji). */
export function whenNotesReady(): Promise<void> {
  return yjsStore.ready();
}
