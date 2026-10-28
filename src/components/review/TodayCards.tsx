import { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { CardSkeleton } from "@/components/ViewSkeleton";
import type { Folder, Note } from "@/hooks/useNotes";
import type { useNotesContext } from "@/hooks/NotesProvider";
import type { useViewRoute } from "@/hooks/useViewRoute";
import type { useTodayCards } from "@/lib/todayCards";

type NotesApi = ReturnType<typeof useNotesContext>;

// Leniwe karty widoku Dziś — każda ładuje się osobno.
const TodayShiftCard = lazy(() => import("@/components/review/TodayShiftCard").then((m) => ({ default: m.TodayShiftCard })));
const TodayDueList = lazy(() => import("@/components/review/TodayDueList").then((m) => ({ default: m.TodayDueList })));
export const StudyDueRows = lazy(() => import("@/components/review/StudyDueRows"));
const TodaySiteCard = lazy(() => import("@/components/review/TodaySiteCard").then((m) => ({ default: m.TodaySiteCard })));
const TodayStudyCard = lazy(() => import("@/components/review/TodayStudyCard").then((m) => ({ default: m.TodayStudyCard })));
const BrainTrainingCard = lazy(() => import("@/components/review/BrainTrainingCard").then((m) => ({ default: m.BrainTrainingCard })));
const WeeklyReviewCard = lazy(() => import("@/components/review/WeeklyReviewCard").then((m) => ({ default: m.WeeklyReviewCard })));

export interface TodayCardsProps {
  /** Wyszukiwanie w toku — karty Dziś chowają się, jak dotąd. */
  searching: boolean;
  go: ReturnType<typeof useViewRoute>["go"];
  notes: Note[];
  folders: Folder[];
  reminderNotes: Note[];
  todayCards: ReturnType<typeof useTodayCards>;
  openNote: (id: string) => void;
  openDailyNote: () => void;
  addNote: NotesApi["addNote"];
  updateNote: NotesApi["updateNote"];
  togglePin: NotesApi["togglePin"];
  archiveNote: NotesApi["archiveNote"];
  unarchiveNote: NotesApi["unarchiveNote"];
  trashNote: NotesApi["trashNote"];
  restoreFromTrash: NotesApi["restoreFromTrash"];
  handleArchiveSingle: (id: string) => void;
  handleMoveToFolderGlow: (id: string, folderId: string | null) => void;
}

/** Karty widoku Dziś (Grafik, przypomnienia, Praca, powtórki, przegląd tygodnia). Każda ma własną granicę błędu. */
export function TodayCards({ searching, go, notes, folders, reminderNotes, todayCards, openNote, openDailyNote, addNote, updateNote, togglePin, archiveNote, unarchiveNote, trashNote, restoreFromTrash, handleArchiveSingle, handleMoveToFolderGlow }: TodayCardsProps) {
  const navigate = useNavigate();
  return (
    <>
          {/* Każda karta Dziś ma własną granicę: błąd w danych Pracy nie kładzie całego widoku, który jest punktem wejścia. */}
          {!searching && (
            <ViewErrorBoundary name="Grafik">
              <Suspense fallback={<CardSkeleton />}>
                <TodayShiftCard onOpenShifts={() => go("shifts")} onDailyNote={openDailyNote} />
              </Suspense>
            </ViewErrorBoundary>
          )}


          {!searching && (
            <ViewErrorBoundary name="Przypomnienia">
              <Suspense fallback={<CardSkeleton />}>
                <TodayDueList notes={reminderNotes} onOpen={openNote} onOpenReminders={() => go("reminders")} onUpdate={updateNote} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {!searching && (
            <ViewErrorBoundary name="Praca">
              <Suspense fallback={null}>
                <StudyDueRows onOpenStudy={(siteId) => go("study", siteId ? { site: siteId } : {})} />
                <TodaySiteCard />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {!searching && (
            <ViewErrorBoundary name="Powtórki">
              <Suspense fallback={<CardSkeleton />}>
                <TodayStudyCard onPractice={() => navigate("/praca?powtorka=1")} />
              </Suspense>
              <Suspense fallback={null}>
                {todayCards.brainTraining && <BrainTrainingCard onRemind={(at, title) => addNote(title, "", "default", [], at)} />}
              </Suspense>
            </ViewErrorBoundary>
          )}

          {!searching && (
            <ViewErrorBoundary name="Przegląd tygodnia">
              <Suspense fallback={<CardSkeleton />}>
                {todayCards.weeklyReview && <WeeklyReviewCard
                  notes={notes} folders={folders} onOpen={openNote} onTogglePin={togglePin}
                  onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow}
                  archiveNote={archiveNote} unarchiveNote={unarchiveNote} trashNote={trashNote} restoreFromTrash={restoreFromTrash}
                />}
              </Suspense>
            </ViewErrorBoundary>
          )}

    </>
  );
}
