import { useState, useEffect, useCallback, useRef } from "react";
import { loadAll, saveNotesIDB, saveLabelsIDB, saveFoldersIDB } from "@/lib/notesStore";
import { applyQueue, enqueueDiff, confirmUpTo, getQueue, RETRY_EVENT } from "@/lib/offlineQueue";

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
  images: string[]; // base64 data URLs
  checklist: ChecklistItem[];
  folderId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "kaczy-notes-data";
const LABELS_KEY = "kaczy-notes-labels";
const FOLDERS_KEY = "kaczy-notes-folders";

function loadNotes(): Note[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem("dash-notes-data");
    }
    const notes: Note[] = raw ? JSON.parse(raw) : [];
    return notes.map((n, i) => ({
      ...n,
      archived: n.archived ?? false,
      trashed: n.trashed ?? false,
      trashedAt: n.trashedAt ?? null,
      labels: n.labels ?? [],
      reminder: n.reminder ?? null,
      images: n.images ?? [],
      checklist: n.checklist ?? [],
      folderId: n.folderId ?? null,
      order: n.order ?? i,
    }));
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function loadLabels(): string[] {
  try {
    let raw = localStorage.getItem(LABELS_KEY);
    if (!raw) raw = localStorage.getItem("dash-notes-labels");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLabels(labels: string[]) {
  localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
}

function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    const folders: Folder[] = raw ? JSON.parse(raw) : [];
    return folders.map((f) => ({ ...f, emoji: f.emoji ?? null }));
  } catch {
    return [];
  }
}

function saveFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
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
  // Synchronous initial state from localStorage for instant first paint.
  // Then we async-hydrate from IndexedDB (which is the source of truth post-migration).
  const [notes, setNotes] = useState<Note[]>(loadNotes);
  const [allLabels, setAllLabels] = useState<string[]>(loadLabels);
  const [folders, setFolders] = useState<Folder[]>(loadFolders);
  const hydratedRef = useRef(false);
  const lastPersistedRef = useRef<Note[]>([]);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Manual retry from the queue panel: re-attempt the IDB write and confirm.
  useEffect(() => {
    const onRetry = () => {
      if (!hydratedRef.current) return;
      const pending = getQueue();
      if (!pending.length) return;
      const snapshot = notesRef.current;
      saveNotesIDB(snapshot).then(() => {
        lastPersistedRef.current = snapshot;
        confirmUpTo(pending[pending.length - 1].seq);
      });
    };
    window.addEventListener(RETRY_EVENT, onRetry);
    return () => window.removeEventListener(RETRY_EVENT, onRetry);
  }, []);

  // One-shot IDB hydrate (also performs LS → IDB migration on first run).
  useEffect(() => {
    let cancelled = false;
    loadAll().then((snap) => {
      if (cancelled) return;
      // Replay any change queued offline / before the last IDB write resolved.
      const pending = getQueue();
      const merged = applyQueue(snap.notes, pending);
      lastPersistedRef.current = snap.notes;
      if (merged.length) setNotes(merged);
      if (snap.labels.length) setAllLabels(snap.labels);
      if (snap.folders.length) setFolders(snap.folders);
      hydratedRef.current = true;
      if (pending.length) {
        // Flush the replayed state straight back into IDB.
        const seq = pending[pending.length - 1].seq;
        saveNotesIDB(merged).then(() => confirmUpTo(seq)).catch(() => {});
        lastPersistedRef.current = merged;
      }
    }).catch(() => { hydratedRef.current = true; });
    return () => { cancelled = true; };
  }, []);

  // Persist to IndexedDB (avoids the 5 MB localStorage cap for image-heavy notes).
  // Every change first lands synchronously in the localStorage queue, so it
  // survives an offline session, a crash or a closed tab mid-write.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const seq = enqueueDiff(lastPersistedRef.current, notes);
    const snapshot = notes;
    saveNotesIDB(snapshot)
      .then(() => {
        lastPersistedRef.current = snapshot;
        if (seq) confirmUpTo(seq);
      })
      .catch(() => { /* keep the queue: it will be replayed on next load */ });
  }, [notes]);
  useEffect(() => { if (hydratedRef.current) saveLabelsIDB(allLabels); }, [allLabels]);
  useEffect(() => { if (hydratedRef.current) saveFoldersIDB(folders); }, [folders]);


  const addNote = useCallback((title: string, content: string, color: NoteColor = "default", labels: string[] = [], reminder: number | null = null, images: string[] = [], checklist: ChecklistItem[] = []) => {
    const now = Date.now();
    const note: Note = { id: crypto.randomUUID(), title, content, color, pinned: false, archived: false, trashed: false, trashedAt: null, labels, reminder, images, checklist, folderId: null, order: 0, createdAt: now, updatedAt: now };
    setNotes((prev) => [note, ...prev]);
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const trashNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, trashed: true, trashedAt: Date.now(), pinned: false, archived: false, updatedAt: Date.now() } : n)));
  }, []);

  const restoreFromTrash = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, trashed: false, trashedAt: null, updatedAt: Date.now() } : n)));
  }, []);

  const emptyTrash = useCallback(() => {
    setNotes((prev) => prev.filter((n) => !n.trashed));
  }, []);

  const togglePin = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n)));
  }, []);

  const duplicateNote = useCallback((id: string) => {
    setNotes((prev) => {
      const original = prev.find((n) => n.id === id);
      if (!original) return prev;
      const now = Date.now();
      const copy: Note = { ...original, id: crypto.randomUUID(), title: original.title ? `${original.title} (kopia)` : "", pinned: false, createdAt: now, updatedAt: now };
      const idx = prev.indexOf(original);
      const newNotes = [...prev];
      newNotes.splice(idx + 1, 0, copy);
      return newNotes;
    });
  }, []);

  const archiveNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: true, pinned: false, updatedAt: Date.now() } : n)));
  }, []);

  const unarchiveNote = useCallback((id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: false, updatedAt: Date.now() } : n)));
  }, []);

  const addLabel = useCallback((label: string) => {
    setAllLabels((prev) => prev.includes(label) ? prev : [...prev, label]);
  }, []);

  const removeLabel = useCallback((label: string) => {
    setAllLabels((prev) => prev.filter((l) => l !== label));
    setNotes((prev) => prev.map((n) => ({ ...n, labels: n.labels.filter((l) => l !== label) })));
  }, []);

  const renameLabel = useCallback((oldLabel: string, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;
    setAllLabels((prev) => prev.map((l) => (l === oldLabel ? trimmed : l)));
    setNotes((prev) => prev.map((n) => ({ ...n, labels: n.labels.map((l) => (l === oldLabel ? trimmed : l)) })));
  }, []);

  const importNotes = useCallback((imported: Note[]) => {
    setNotes((prev) => {
      const existingIds = new Set(prev.map((n) => n.id));
      const newNotes = imported.filter((n) => !existingIds.has(n.id));
      return [...newNotes, ...prev];
    });
    const importedLabels = new Set(imported.flatMap((n) => n.labels));
    setAllLabels((prev) => {
      const all = new Set(prev);
      importedLabels.forEach((l) => all.add(l));
      return [...all];
    });
  }, []);

  const reorderNotes = useCallback((activeIds: string[]) => {
    setNotes((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      const reordered = activeIds.map((id) => map.get(id)!).filter(Boolean);
      const archived = prev.filter((n) => n.archived);
      return [...reordered, ...archived];
    });
  }, []);

  // Folder operations
  const addFolder = useCallback((name: string, parentId: string | null = null, color: FolderColor = "default") => {
    const folder: Folder = { id: crypto.randomUUID(), name: name.trim(), color, emoji: null, parentId, order: 0, createdAt: Date.now() };
    setFolders((prev) => [folder, ...prev]);
    return folder.id;
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Omit<Folder, "id" | "createdAt">>) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => {
      // Get all descendant IDs
      const descendantIds = getDescendantFolderIds(id, prev);
      const allRemoved = new Set([id, ...descendantIds]);
      return prev.filter((f) => !allRemoved.has(f.id));
    });
    // Remove folder reference from notes
    setNotes((prev) => {
      const descendantIds = getDescendantFolderIds(id, folders);
      const allRemoved = new Set([id, ...descendantIds]);
      return prev.map((n) => (n.folderId && allRemoved.has(n.folderId) ? { ...n, folderId: null, updatedAt: Date.now() } : n));
    });
  }, [folders]);

  const moveNoteToFolder = useCallback((noteId: string, folderId: string | null) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, folderId, updatedAt: Date.now() } : n)));
  }, []);

  // Auto-cleanup: remove notes trashed more than 30 days ago
  useEffect(() => {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const hasExpired = notes.some((n) => n.trashed && n.trashedAt && now - n.trashedAt > THIRTY_DAYS);
    if (hasExpired) {
      setNotes((prev) => prev.filter((n) => !(n.trashed && n.trashedAt && now - n.trashedAt > THIRTY_DAYS)));
    }
  }, [notes]);

  const activeNotes = [...notes.filter((n) => !n.archived && !n.trashed)].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const archivedNotes = [...notes.filter((n) => n.archived && !n.trashed)].sort((a, b) => b.updatedAt - a.updatedAt);

  const trashedNotes = [...notes.filter((n) => n.trashed)].sort((a, b) => b.updatedAt - a.updatedAt);

  const bulkTrash = useCallback((ids: string[]) => {
    const set = new Set(ids); const now = Date.now();
    setNotes((prev) => prev.map((n) => (set.has(n.id) ? { ...n, trashed: true, trashedAt: now, pinned: false, archived: false, updatedAt: now } : n)));
  }, []);
  const bulkArchive = useCallback((ids: string[]) => {
    const set = new Set(ids); const now = Date.now();
    setNotes((prev) => prev.map((n) => (set.has(n.id) ? { ...n, archived: true, pinned: false, updatedAt: now } : n)));
  }, []);
  const bulkSetColor = useCallback((ids: string[], color: NoteColor) => {
    const set = new Set(ids); const now = Date.now();
    setNotes((prev) => prev.map((n) => (set.has(n.id) ? { ...n, color, updatedAt: now } : n)));
  }, []);
  const bulkRestore = useCallback((ids: string[]) => {
    const set = new Set(ids); const now = Date.now();
    setNotes((prev) => prev.map((n) => (set.has(n.id) ? { ...n, trashed: false, trashedAt: null, archived: false, updatedAt: now } : n)));
  }, []);

  return { notes: activeNotes, archivedNotes, trashedNotes, allLabels, folders, addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote, archiveNote, unarchiveNote, addLabel, removeLabel, renameLabel, importNotes, reorderNotes, addFolder, updateFolder, deleteFolder, moveNoteToFolder, bulkTrash, bulkArchive, bulkSetColor, bulkRestore };
}
