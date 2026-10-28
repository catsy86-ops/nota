import { Suspense, lazy } from "react";
import { cn } from "@/lib/utils";
import { ReminderListGroups } from "@/components/reminders/ReminderListGroups";
import { NoteGroupSection } from "@/components/NoteGroupSection";
import { StudyDueRows } from "@/components/review/TodayCards";
import { setRemindersLayout, effectiveRemindersLayout } from "@/lib/remindersLayout";
import type { AgendaGroup } from "@/lib/reminderAgenda";
import type { RepeatInput } from "@/lib/reminderRepeat";
import type { Note } from "@/hooks/useNotes";
import type { useViewRoute } from "@/hooks/useViewRoute";
import type { useNotesContext } from "@/hooks/NotesProvider";
import type { ReactNode } from "react";

type NotesApi = ReturnType<typeof useNotesContext>;

// Leniwe części widoku Terminy — ładują się dopiero tutaj.
const NewReminderButton = lazy(() => import("@/components/reminders/NewReminderButton"));
const SeriesForecastSection = lazy(() => import("@/components/calendar/SeriesForecastSection"));

export interface RemindersViewProps {
  go: ReturnType<typeof useViewRoute>["go"];
  reminderNotes: Note[];
  reminderGroups: AgendaGroup[];
  archivedRows: Note[];
  remindersLayout: ReturnType<typeof effectiveRemindersLayout>;
  openNote: (id: string) => void;
  updateNote: NotesApi["updateNote"];
  createReminderNote: (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => void;
  attachReminder: (id: string, reminder: number, repeat: RepeatInput, allDay: boolean, base: number | undefined, until?: number) => void;
  /** Siatka kafli notatek z obsługą klawiatury — ta sama, co w widokach notatek. */
  renderGrid: (gridNotes: Note[], navOrder: number) => ReactNode;
}

/** Widok Terminy: nowy termin, układ (kafle / lista), grupy według terminu i prognoza serii. */
export function RemindersView({ go, reminderNotes, reminderGroups, archivedRows, remindersLayout, openNote, updateNote, createReminderNote, attachReminder, renderGrid }: RemindersViewProps) {
  return (
    <>
          {(
            <Suspense fallback={null}>
              <StudyDueRows onOpenStudy={(siteId) => go("study", siteId ? { site: siteId } : {})} />
            </Suspense>
          )}
          {(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Suspense fallback={null}>
                <NewReminderButton notes={reminderNotes} onCreateNote={createReminderNote} onAttachReminder={attachReminder} />
              </Suspense>
              <div role="group" aria-label="Układ Terminów" className="flex gap-1">
                {(["tiles", "list"] as const).map((layout) => (
                  <button key={layout} type="button" aria-pressed={remindersLayout === layout} onClick={() => setRemindersLayout(layout)} className={cn("rounded-full px-3 py-1 text-xs font-medium coarse:min-h-11", remindersLayout === layout ? "bg-primary/10 text-primary-ink" : "text-muted-foreground hover:text-foreground")}>
                    {layout === "tiles" ? "Kafle" : "Lista"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {remindersLayout === "list" && (
            <>
              <ReminderListGroups groups={reminderGroups} onOpen={openNote} onUpdate={updateNote} />
              {archivedRows.length > 0 && <ReminderListGroups groups={[{ key: "archive", label: "W archiwum", notes: archivedRows }]} onOpen={openNote} onUpdate={updateNote} />}
            </>
          )}
          {remindersLayout === "tiles" && reminderGroups.map((group, i) => (
            <NoteGroupSection key={group.key} groupKey={`reminders-${group.key}`} label={group.label} count={group.notes.length} tone={group.key === "overdue" || group.key === "missed" ? "alert" : "default"}>
              {renderGrid(group.notes, i)}
            </NoteGroupSection>
          ))}
          {remindersLayout === "tiles" && archivedRows.length > 0 && (
            <NoteGroupSection groupKey="reminders-archive" label="W archiwum" count={archivedRows.length}>
              {renderGrid(archivedRows, reminderGroups.length)}
            </NoteGroupSection>
          )}
          {(
            <Suspense fallback={null}>
              <SeriesForecastSection notes={reminderNotes} />
            </Suspense>
          )}

    </>
  );
}
