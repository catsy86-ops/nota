import { Suspense } from "react";
import { toast } from "sonner";
import type { Folder, Note, useNotes } from "@/hooks/useNotes";
import type { InboxCaptureExtras } from "@/components/InboxCapture";
import type { useExternalImport } from "@/hooks/useImportExport";
import type { AppDialogs } from "@/hooks/useAppDialogs";
import { ShortcutsDialog, PropDefsDialog, RecentActionsPanel, ImportExternalDialog, SettingsDialog, StatsDialog, QuickInboxDialog, FocusMode } from "@/pages/indexViews";

type Notes = ReturnType<typeof useNotes>;

interface Props {
  dialogs: AppDialogs;
  notes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  allLabels: string[];
  folders: Folder[];
  propDefs: Notes["propDefs"];
  addPropDef: Notes["addPropDef"];
  updatePropDef: Notes["updatePropDef"];
  deletePropDef: Notes["deletePropDef"];
  addNote: Notes["addNote"];
  externalImport: ReturnType<typeof useExternalImport>;
  captureToInbox: (title: string, content: string, extras?: InboxCaptureExtras) => void;
  captureFilesToInbox: (files: File[], text: string) => void;
  openNote: (id: string) => void;
}

/**
 * Okna ładowane leniwie, otwierane z wielu miejsc strony (pasek boczny, nagłówek, paleta, skróty): Do skrzynki,
 * Statystyki, Ustawienia, import z innych aplikacji, Skróty, Pola notatek, Tryb skupienia i Ostatnie działania.
 * Stan „otwarte” trzyma `useAppDialogs`; tu tylko montowanie po otwarciu. Wyciągnięte z `Index.tsx` bez zmiany zachowania.
 */
export function IndexDialogs({ dialogs, notes, archivedNotes, trashedNotes, allLabels, folders, propDefs, addPropDef, updatePropDef, deletePropDef, addNote, externalImport, captureToInbox, captureFilesToInbox, openNote }: Props) {
  const { quickInboxOpen, setQuickInboxOpen, statsOpen, setStatsOpen, settingsOpen, setSettingsOpen, shortcutsOpen, setShortcutsOpen, propDefsOpen, setPropDefsOpen, focusModeOpen, setFocusModeOpen, actionsOpen, setActionsOpen } = dialogs;
  return (
    <>
    {quickInboxOpen && (
      <Suspense fallback={null}>
        <QuickInboxDialog open={quickInboxOpen} onOpenChange={setQuickInboxOpen} onCapture={captureToInbox} onFiles={captureFilesToInbox} labels={allLabels} folders={folders} />
      </Suspense>
    )}
    {statsOpen && (
      <Suspense fallback={null}>
        <StatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          notes={notes}
          archivedNotes={archivedNotes}
          allLabels={allLabels}
          folders={folders}
        />
      </Suspense>
    )}
    {/* Tu, nie w pasku bocznym: pasek istnieje tylko gdy jest otwarty (na telefonie
        domyślnie zamknięty), a Ustawienia otwiera też „Więcej” i paleta poleceń. */}
    {settingsOpen && (
      <Suspense fallback={null}>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </Suspense>
    )}
    {externalImport.open && (
      <Suspense fallback={null}>
        <ImportExternalDialog
          open={externalImport.open}
          stage={externalImport.stage}
          plan={externalImport.plan}
          error={externalImport.error}
          onPickFiles={externalImport.pickFiles}
          onConfirm={externalImport.confirm}
          onBack={externalImport.backToPick}
          onClose={externalImport.close}
        />
      </Suspense>
    )}
    {shortcutsOpen && (
      <Suspense fallback={null}>
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </Suspense>
    )}
    {propDefsOpen && (
      <Suspense fallback={null}>
        <PropDefsDialog
          open={propDefsOpen}
          onOpenChange={setPropDefsOpen}
          defs={propDefs}
          onAdd={addPropDef}
          onUpdate={updatePropDef}
          onDelete={deletePropDef}
        />
      </Suspense>
    )}
    {focusModeOpen && (
      <Suspense fallback={null}>
        <FocusMode
          open={focusModeOpen}
          onOpenChange={setFocusModeOpen}
          onSave={(title, content) => { addNote(title, content); toast.success("Zapisano notatkę 🧠"); }}
        />
      </Suspense>
    )}
    {actionsOpen && (
      <Suspense fallback={null}>
        <RecentActionsPanel
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          onOpenNote={(ids) => {
            const existing = [...notes, ...archivedNotes, ...trashedNotes].find((n) => ids.includes(n.id));
            openNote(existing?.id ?? ids[0]);
          }}
        />
      </Suspense>
    )}
    </>
  );
}
