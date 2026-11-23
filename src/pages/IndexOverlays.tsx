import { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import { useNotesContext } from "@/hooks/NotesProvider";
import type { AppDialogs } from "@/hooks/useAppDialogs";
import type { useExternalImport } from "@/hooks/useImportExport";
import type { useReaderNav } from "@/hooks/useReaderNav";
import type { View } from "@/lib/types/view";
import type { InboxCaptureExtras } from "@/components/InboxCapture";
import type { ComposerAction } from "@/components/AddNoteBar";
import type { WikiIndex } from "@/lib/wikiLinks";
import { IndexDialogs } from "@/components/IndexDialogs";
import { DeleteForeverDialog, EmptyTrashDialog } from "@/components/TrashConfirmDialogs";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { resolveWikiTarget } from "@/lib/wikiLinks";
import { toggleChecklistItem } from "@/lib/checklistTree";
import { CommandPalette, InboxTriage, NoteReader } from "./indexViews";

type ReaderNav = ReturnType<typeof useReaderNav>;

interface Props {
  dialogs: AppDialogs;
  view: View;
  search: string;
  byId: Map<string, Note>;
  reminderNotes: Note[];
  allNotesForLinks: Note[];
  knownTitles: Set<string>;
  wikiIndex: WikiIndex;
  reader: Pick<ReaderNav, "readerNote" | "readerSteps" | "copyTarget" | "stepReader" | "editFromReader" | "showInReader" | "splitNote" | "setSplit">;
  presenting: boolean;
  closeReader: () => void;
  openNote: (id: string, ...rest: [boolean?, boolean?]) => void;
  openDailyNote: () => void;
  openPeriodNote: (kind: "week" | "month") => void;
  goFilter: (filter: string) => void;
  setView: (v: View) => void;
  expandAddNote: (action?: ComposerAction, prefill?: string) => void;
  toggleTheme: () => void;
  noteActions: {
    archive: (id: string) => void;
    trash: (id: string) => void;
    moveToFolder: (id: string, folderId: string | null) => void;
    deleteForever: (id: string) => void;
    deleteVersions: (ids: string | string[]) => void;
  };
  clearSelection: () => void;
  externalImport: ReturnType<typeof useExternalImport>;
  captureToInbox: (title: string, content: string, extras?: InboxCaptureExtras) => void;
  captureFilesToInbox: (files: File[], text: string) => void;
}

/**
 * A2.4: wszystkie nakładki strony głównej w jednym miejscu — paleta, czytnik, okna z `IndexDialogs`, triaż Skrzynki
 * i potwierdzenia Kosza. Stan otwarcia jest w jednym reduktorze (`useAppDialogs`); każda nakładka montuje się leniwie
 * dopiero po otwarciu. „Wstecz” zamyka je przez `overlayHistory` (`NoteReader` i `ui/overlay-back` w oknach Radix).
 */
export function IndexOverlays(p: Props) {
  const { notes, archivedNotes, trashedNotes, allLabels, folders, propDefs, addPropDef, updatePropDef, deletePropDef, addNote, updateNote, togglePin, duplicateNote, emptyTrash } = useNotesContext();
  const { dialogs, reader, noteActions } = p;
  const { paletteOpen, setPaletteOpen, setSettingsOpen, setStatsOpen, setQuickInboxOpen, setFocusModeOpen, setShortcutsOpen } = dialogs;
  const { readerNote, copyTarget } = reader;

  return (
    <>
      {dialogs.triageMounted && (
        <Suspense fallback={null}>
          <InboxTriage open={dialogs.triageOpen} onOpenChange={dialogs.setTriageOpen} onOpenNote={(id) => p.openNote(id, false, true)} />
        </Suspense>
      )}
      <DeleteForeverDialog
        ids={dialogs.confirmDeleteIds}
        onCancel={() => dialogs.setConfirmDeleteIds(null)}
        onConfirm={(ids) => {
          ids.forEach(noteActions.deleteForever);
          p.clearSelection();
          toast.success(`Usunięto trwale: ${ids.length}`);
          dialogs.setConfirmDeleteIds(null);
        }}
      />
      <EmptyTrashDialog
        open={dialogs.confirmEmptyTrash}
        onOpenChange={dialogs.setConfirmEmptyTrash}
        count={trashedNotes.length}
        onConfirm={() => { noteActions.deleteVersions(trashedNotes.map((n) => n.id)); emptyTrash(); toast.success("Kosz opróżniony"); dialogs.setConfirmEmptyTrash(false); }}
      />
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            notes={p.reminderNotes}
            onOpenNote={p.openNote}
            onNewNote={(title) => p.expandAddNote(undefined, title)}
            onDailyNote={p.openDailyNote}
            onPeriodNote={p.openPeriodNote}
            onGo={p.setView}
            onGoFilter={p.goFilter}
            onToggleTheme={p.toggleTheme}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenStats={() => setStatsOpen(true)}
            onQuickInbox={() => setQuickInboxOpen(true)}
            onOpenFocusMode={() => setFocusModeOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            onCopyNote={copyTarget ? (fmt) => { void copyNoteToClipboard(copyTarget, fmt); } : undefined}
            currentNote={copyTarget}
            onTogglePin={(id) => togglePin(id)}
            onArchive={noteActions.archive}
            onTrash={noteActions.trash}
            onDuplicate={duplicateNote}
            onToggleFavorite={(id, favorite) => updateNote(id, { favorite })}
            onMoveToFolder={noteActions.moveToFolder}
            view={p.view}
          />
        </Suspense>
      )}
      <IndexDialogs
        dialogs={dialogs}
        notes={notes} archivedNotes={archivedNotes} trashedNotes={trashedNotes} allLabels={allLabels} folders={folders}
        propDefs={propDefs} addPropDef={addPropDef} updatePropDef={updatePropDef} deletePropDef={deletePropDef}
        addNote={addNote} externalImport={p.externalImport} captureToInbox={p.captureToInbox} captureFilesToInbox={p.captureFilesToInbox} openNote={p.openNote}
      />
      <AnimatePresence>
        {readerNote && (
          <Suspense key="reader" fallback={null}>
            <NoteReader
              note={readerNote}
              mode={p.presenting ? "present" : "preview"}
              searchQuery={p.search}
              knownTitles={p.knownTitles}
              wikiIndex={p.wikiIndex}
              onClose={p.closeReader}
              onStep={reader.stepReader}
              canPrev={!!reader.readerSteps.prev}
              canNext={!!reader.readerSteps.next}
              onEdit={reader.editFromReader}
              onShow={reader.showInReader}
              splitNote={reader.splitNote}
              onSplit={reader.setSplit}
              resolveTitle={(title) => resolveWikiTarget(title, p.allNotesForLinks)?.id}
              propDefs={propDefs}
              onUpdateProps={updateNote}
              onToggleChecklist={(noteId, itemId) => {
                const n = p.byId.get(noteId);
                if (!n || n.trashed) return;
                updateNote(noteId, { checklist: toggleChecklistItem(n.checklist, itemId).items });
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </>
  );
}
