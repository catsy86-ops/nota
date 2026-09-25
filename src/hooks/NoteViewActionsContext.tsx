import { createContext, useContext, type ReactNode } from "react";
import type { Note } from "@/hooks/useNotes";
import type { NoteVersion } from "@/hooks/useNoteVersions";

/**
 * Per-note-list mutators/config for NoteCard, provided once by NoteGrid
 * instead of drilled through NoteGrid -> SortableNoteCard -> NoteCard props.
 * Each NoteGrid instance (pinned/others, notes/archive/trash view) supplies
 * its own value, so behavior stays identical to the old prop-drilled version —
 * only the delivery channel changes.
 */
export interface NoteViewActions {
  onUpdate?: (id: string, updates: Partial<Omit<Note, "id" | "createdAt">>) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onMoveToFolder?: (noteId: string, folderId: string | null) => void;
  isArchived?: boolean;
  getVersions?: (noteId: string) => NoteVersion[];
  onSaveVersion?: (noteId: string, title: string, content: string) => void;
  onRestoreVersion?: (noteId: string, version: NoteVersion) => void;
  onPresent?: (id: string) => void;
  knownTitles?: Set<string>;
  onWikiClick?: (title: string) => void;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
}

const NoteViewActionsContext = createContext<NoteViewActions | null>(null);

export function NoteViewActionsProvider({ value, children }: { value: NoteViewActions; children: ReactNode }) {
  return <NoteViewActionsContext.Provider value={value}>{children}</NoteViewActionsContext.Provider>;
}

export function useNoteViewActions(): NoteViewActions {
  const ctx = useContext(NoteViewActionsContext);
  if (!ctx) throw new Error("useNoteViewActions must be used within a NoteViewActionsProvider (rendered by NoteGrid)");
  return ctx;
}
