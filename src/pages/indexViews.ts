import { lazy } from "react";
import type { View } from "@/hooks/useFilteredNotes";
import { loadCalendarView, loadShiftsView, loadStudyView } from "@/lib/viewPreload";

// Kolejność działów (jak w pasku bocznym) — od niej zależy kierunek przejścia między widokami.
export const VIEW_ORDER: View[] = ["notes", "today", "week", "reminders", "calendar", "shifts", "study", "debts", "cwiczenia", "archive", "trash", "inbox", "label", "folder", "widget"];

export const ShortcutsDialog = lazy(() => import("@/components/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })));
export const PropDefsDialog = lazy(() => import("@/components/PropDefsDialog").then((m) => ({ default: m.PropDefsDialog })));
export const SeriesForecastSection = lazy(() => import("@/components/calendar/SeriesForecastSection"));
export const WidgetPanel = lazy(() => import("@/components/WidgetPanel").then((m) => ({ default: m.WidgetPanel })));
export const RecentActionsPanel = lazy(() => import("@/components/RecentActionsPanel").then((m) => ({ default: m.RecentActionsPanel })));
export const OnboardingTour = lazy(() => import("@/components/OnboardingTour").then((m) => ({ default: m.OnboardingTour })));
export const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
export const ImportExternalDialog = lazy(() => import("@/components/ImportExternalDialog").then((m) => ({ default: m.ImportExternalDialog })));
export const SettingsDialog = lazy(() => import("@/components/SettingsDialog").then((m) => ({ default: m.SettingsDialog })));
export const StatsDialog = lazy(() => import("@/components/StatsDialog").then((m) => ({ default: m.StatsDialog })));
export const FocusMode = lazy(() => import("@/components/FocusMode").then((m) => ({ default: m.FocusMode })));
// Kalendarz wchodzi tylko po wejściu w swój widok — siatka notatek go nie potrzebuje.
// Grafik zmian — osobny dział, ładowany dopiero po wejściu.
// Loadery wspólne z nawigacją (`preloadView` przy `pointerdown`), patrz lib/viewPreload.ts.
export const StudyView = lazy(loadStudyView);
export const DebtsView = lazy(() => import("@/components/debts/DebtsView").then((m) => ({ default: m.DebtsView })));
export const CwiczeniaView = lazy(() => import("@/components/cwiczenia/CwiczeniaView").then((m) => ({ default: m.CwiczeniaView })));
// Porządkowanie Skrzynki — okno ładuje się przy pierwszym otwarciu.
export const InboxTriage = lazy(() => import("@/components/InboxTriage").then((m) => ({ default: m.InboxTriage })));
export const ShiftsView = lazy(() => loadShiftsView().then((m) => ({ default: m.ShiftsView })));
export const ReminderCalendarView = lazy(() => loadCalendarView().then((m) => ({ default: m.ReminderCalendarView })));
// „Nowy termin” w Terminach — dialog z kalendarzem; ładowany dopiero na tym widoku.
export const NewReminderButton = lazy(() => import("@/components/reminders/NewReminderButton"));
// Przypomnienie „Raport dnia gotowy” (dział Praca) — leniwie, żeby dziennik nie wchodził do głównej paczki.
export const DailyReportNudge = lazy(() => import("@/components/study/DailyReportNudge"));
// Harmonogram dla serwera push — tylko przy włączonych powiadomieniach przy zamkniętej aplikacji.
export const PushScheduleSync = lazy(() => import("@/components/PushScheduleSync"));
export const StudyOverdueSync = lazy(() => import("@/components/review/StudyOverdueSync"));
// Czytnik notatek poza paczką startową; doczytywany w tle, gdy przeglądarka odpocznie (patrz efekt w `Index`),
// więc pierwsze otwarcie notatki nie czeka.
export const loadNoteReader = () => import("@/components/NoteReader");
export const NoteReader = lazy(() => loadNoteReader().then((m) => ({ default: m.NoteReader })));
