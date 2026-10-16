import { useState, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, lazy, Suspense } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { StickyNote, Archive, Bell, Trash, Calendar, CalendarRange, BriefcaseBusiness, HardHat } from "lucide-react";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useOverdueBadge } from "@/hooks/useOverdueBadge";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs, toggleGroupCollapsed } from "@/lib/viewPrefs";
import { useFilteredNotes, type View } from "@/hooks/useFilteredNotes";
import { useViewRoute } from "@/hooks/useViewRoute";
import { parseViewRoute } from "@/lib/viewRoute";
import { groupReminders } from "@/lib/reminderAgenda";
import { buildWikiIndex, resolveWikiTarget, splitWikiTarget, wikiIndexKey } from "@/lib/wikiLinks";
import { requestHeading } from "@/lib/wikiHeading";
import { useLatestRef, useStableByKey } from "@/hooks/useLatestRef";
import { useGridNavPreviewId, getGridNavFocusedId, setGridNavPreview, setGridNavFocus } from "@/lib/gridKeyboardNav";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { NoteReader, type ReaderMode } from "@/components/NoteReader";
import { playEnter, tween } from "@/lib/motion";
import { useNavigate, useNavigationType } from "react-router-dom";
import { claimShare, parseShare, SHARE_PATH } from "@/lib/shareTarget";
import { whenNotesReady, isNoteTextEditOpen } from "@/hooks/useNotes";
import { DAILY_LABEL, DAILY_TEMPLATE, appendTimestamp, dailyKey, dailyTitle, findDailyNote } from "@/lib/dailyNote";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport, useExternalImport } from "@/hooks/useImportExport";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { useShiftEveningNudge } from "@/hooks/useShiftEveningNudge";
import { useDailyWeeklyNudges } from "@/hooks/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { AddNoteBar, type ComposerAction, type ComposerExtras } from "@/components/AddNoteBar";
import { InstallBanner } from "@/components/InstallBanner";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { NoteGrid } from "@/components/NoteGrid";
import { BoardColumn } from "@/components/BoardColumn";
import { NoteBoard } from "@/components/NoteBoard";
import { NoteTable } from "@/components/NoteTable";
import { columnOfNote, labelsForColumn, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";
import { NoteGroupSection } from "@/components/NoteGroupSection";
import { groupNotes, type GroupBy } from "@/lib/groupNotes";
import { markNoteOpened } from "@/lib/lastOpened";
import { EmptyState } from "@/components/EmptyState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";
import { downloadNotesZip } from "@/lib/exportZip";
import { pluralPl } from "@/lib/plural";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import { fireworks, megaCelebrate } from "@/lib/celebrate";
import { glowPulse, glowStreak, centerOf, pointOfNote } from "@/lib/glowTrail";
import { SearchBar } from "@/components/SearchBar";
import { useAchievementTracker } from "@/lib/achievements";
import { useDayDoneReward } from "@/hooks/useDayDoneReward";
import { showAchievementStamp, stampAllowed } from "@/lib/achievementStamp";
import { AchievementStamp } from "@/components/AchievementStamp";
import { DailyQuote } from "@/components/DailyQuote";
import { PaperBackdrop } from "@/components/PaperBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { VaultHost } from "@/components/vault/VaultHost";

// Dialogs that aren't part of the initial view (opened via keyboard shortcut,
// note action or explicit toggle) — kept out of the eager main bundle so
// first load only pays for the code the note grid itself needs.
import { ViewSkeleton } from "@/components/ViewSkeleton";
import { loadCalendarView, loadShiftsView, loadStudyView } from "@/lib/viewPreload";
const ShortcutsDialog = lazy(() => import("@/components/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })));
const PropDefsDialog = lazy(() => import("@/components/PropDefsDialog").then((m) => ({ default: m.PropDefsDialog })));
const WeeklyReviewCard = lazy(() => import("@/components/review/WeeklyReviewCard").then((m) => ({ default: m.WeeklyReviewCard })));
const RecentActionsPanel = lazy(() => import("@/components/RecentActionsPanel").then((m) => ({ default: m.RecentActionsPanel })));
const OnboardingTour = lazy(() => import("@/components/OnboardingTour").then((m) => ({ default: m.OnboardingTour })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
const ImportExternalDialog = lazy(() => import("@/components/ImportExternalDialog").then((m) => ({ default: m.ImportExternalDialog })));
const SettingsDialog = lazy(() => import("@/components/SettingsDialog").then((m) => ({ default: m.SettingsDialog })));
const StatsDialog = lazy(() => import("@/components/StatsDialog").then((m) => ({ default: m.StatsDialog })));
const FocusMode = lazy(() => import("@/components/FocusMode").then((m) => ({ default: m.FocusMode })));
// Kalendarz wchodzi tylko po wejściu w swój widok — siatka notatek go nie potrzebuje.
// Grafik zmian — osobny dział, ładowany dopiero po wejściu.
// Loadery wspólne z nawigacją (`preloadView` przy `pointerdown`), patrz lib/viewPreload.ts.
const StudyView = lazy(loadStudyView);
const ShiftsView = lazy(() => loadShiftsView().then((m) => ({ default: m.ShiftsView })));
const ReminderCalendarView = lazy(() => loadCalendarView().then((m) => ({ default: m.ReminderCalendarView })));

const Index = () => {
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders, propDefs, addPropDef, updatePropDef, deletePropDef,
    addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote,
    archiveNote, unarchiveNote, addLabel, importNotes, reorderNotes, moveNoteToFolder,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore,
  } = useNotesContext();
  const { addVersion, getVersions, deleteVersions } = useNoteVersions();
  const { confirmAction, confirmDialog } = useConfirmAction();
  const { dark, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const prefs = useViewPrefs();
  // Widok, folder, etykieta i zapytanie żyją w adresie (patrz `lib/viewRoute.ts`).
  const route = useViewRoute();
  const { view, label: activeLabel, folder: activeFolder, go, replaceWith } = route;
  const setView = useCallback((v: View) => go(v), [go]);
  // Pole wyszukiwania ma własny stan (karetka nie może czekać na router);
  // adres dostaje go z opóźnieniem zerowym, a „wstecz/dalej” wlewa z powrotem.
  const [search, setSearch] = useState(route.search);
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    if (navigationType === "POP") setSearch(route.search);
  }, [route.search, navigationType]);
  // Pole dostaje każdy znak od razu; filtrowanie kart i adres idą odroczonym
  // renderem, który React przerywa przy kolejnym znaku — pisanie nie czeka na 150 kart.
  const deferredSearch = useDeferredValue(search);
  const setRouteSearch = route.setSearch;
  useEffect(() => {
    if (deferredSearch !== parseViewRoute(window.location.pathname, window.location.search).search) setRouteSearch(deferredSearch);
  }, [deferredSearch, setRouteSearch]);
  // Zmiana widoku (także folderu i etykiety): treść osiada fade'em z 6 px,
  // zamiast podmienić się skokiem. Bez przemontowania — szkic w pasku nowej
  // notatki i stan siatek przetrwają; pole wyszukiwania (data-view-static) stoi.
  const mainRef = useRef<HTMLElement>(null);
  const viewKey = `${view}|${activeFolder ?? ""}|${activeLabel ?? ""}`;
  const prevViewKey = useRef(viewKey);
  useLayoutEffect(() => {
    if (prevViewKey.current === viewKey) return;
    prevViewKey.current = viewKey;
    for (const el of mainRef.current?.children ?? []) {
      if (!el.hasAttribute("data-view-static")) playEnter(el, { opacity: 0, transform: "translateY(6px)" });
    }
  }, [viewKey]);
  // Start zgodny z efektem poniżej (desktop: otwarty), żeby pasek nie wjeżdżał od zera po montażu
  // i nie przesuwał całej treści przy każdym wczytaniu strony.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const addNoteRef = useRef<{ expand: (action?: ComposerAction) => void }>(null);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Link z kodu QR (`?pair=…`) otwiera Ustawienia → Sync; kod odczytuje i usuwa z adresu
  // `SettingsDialog`, który montuje się dopiero po otwarciu.
  const [settingsOpen, setSettingsOpen] = useState(() => new URLSearchParams(window.location.search).has("pair"));
  const [statsOpen, setStatsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [propDefsOpen, setPropDefsOpen] = useState(false);
  const [presentingNoteId, setPresentingNoteId] = useState<string | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);
  const selectionMode = selectedIds.size > 0;

  // Reset selection whenever the view or active label/folder changes.
  useEffect(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, [view, activeLabel, activeFolder]);

  function handleLogoClick() {
    const now = Date.now();
    const state = logoClicksRef.current;
    if (now - state.lastTs > 600) state.count = 0;
    state.lastTs = now;
    state.count += 1;
    if (state.count >= 3) {
      state.count = 0;
      fireworks();
      toast.success("🎉 Niespodzianka!");
    }
  }

  // Auto-close sidebar on mobile, auto-open on desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const openNoteRef = useRef<(id: string) => void>(() => {});
  // Stabilna tablica: nowa w każdym renderze restartowałaby sprawdzanie przy każdym znaku w wyszukiwarce.
  const reminderNotes = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
  useReminderNotifications(
    reminderNotes,
    (id, nextReminder, reminderDay) => updateNote(id, { reminder: nextReminder, reminderDay }),
    (id) => openNoteRef.current(id),
    (id) => updateNote(id, { reminderRepeat: "none", reminderRepeatUntil: undefined }),
    trashedNotes,
    () => go("reminders"),
  );

  // Odznaki w głównym widoku: jeden cichy toast na paczkę (import potrafi odblokować
  // kilka naraz), stałe `id` podmienia go zamiast piętrzyć. Szczegóły są w Statystykach.
  // Nad otwartym oknem (edytor nowej notatki) odznaka by go zasłaniała — czeka, aż okno się zamknie.
  // Czeka też na inne dymki: przy starcie „N przypomnień czeka” u góry i odznaki u dołu zasłaniały naraz nagłówek i ostatni kafel.
  const unlockedBatchRef = useRef<{ titles: string[]; description: string }>({ titles: [], description: "" });
  const badgeTimerRef = useRef<number | null>(null);
  const showBadgeToast = useCallback(() => {
    if (document.querySelector('[role="dialog"][data-state="open"], [data-sonner-toast]:not([data-removed="true"]):not(.toast-achievements)')) {
      badgeTimerRef.current = window.setTimeout(showBadgeToast, 1000);
      return;
    }
    badgeTimerRef.current = null;
    const { titles, description } = unlockedBatchRef.current;
    const reset = () => { unlockedBatchRef.current = { titles: [], description: "" }; };
    toast(titles.length === 1 ? `Nowa odznaka: ${titles[0]}` : `Nowe odznaki: ${titles.length}`, {
      id: "achievements",
      className: "toast-achievements",
      description: titles.length === 1 ? description : titles.join(", "),
      duration: 4000,
      action: { label: "Zobacz", onClick: () => setStatsOpen(true) },
      onAutoClose: reset,
      onDismiss: reset,
    });
  }, []);
  useEffect(() => () => { if (badgeTimerRef.current !== null) clearTimeout(badgeTimerRef.current); }, []);
  useAchievementTracker(notes, archivedNotes, allLabels, folders, (a) => {
    // Pieczątka zastępuje dymek (przy wyłączonym efekcie / reduced motion zostaje dymek).
    // Nad otwartym oknem lub edytorem nowej notatki zasłaniałaby pisany tekst — czeka na zamknięcie.
    if (stampAllowed()) {
      const attempt = (left: number) => {
        const busy = document.querySelector('[role="dialog"][data-state="open"], [data-composer-open]');
        if (busy && left > 0) { window.setTimeout(() => attempt(left - 1), 800); return; }
        showAchievementStamp(a);
      };
      attempt(40);
      return;
    }
    unlockedBatchRef.current.titles.push(a.title);
    unlockedBatchRef.current.description = a.description;
    if (badgeTimerRef.current === null) showBadgeToast();
  });

  useBackupReminders(prefs, notes, archivedNotes);
  useDailyWeeklyNudges(prefs, notes, setView);
  useShiftEveningNudge(useCallback(() => setView("shifts"), [setView]));

  // Pasek dodawania jest też w folderze i etykiecie — nowa notatka dziedziczy
  // ten kontekst (`handleAddNoteGlow`), zamiast lądować poza widokiem.
  const canCompose = view === "notes" || (view === "folder" && !!activeFolder) || (view === "label" && !!activeLabel);
  const composeDestination = view === "folder"
    ? folders.find((f) => f.id === activeFolder)?.name ?? null
    : view === "label" ? `#${activeLabel}` : null;

  function expandAddNote(action?: ComposerAction) {
    if (!canCompose) setView("notes");
    setTimeout(() => addNoteRef.current?.expand(action), 100);
  }

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, []);

  useGlobalShortcuts({
    onNewNote: expandAddNote,
    onGoToday: () => go("today"),
    onGoWeek: () => go("week"),
    onGoView: (v) => go(v),
    onEasterEgg: () => { megaCelebrate(); toast.success("🎮 KONAMI! Pełen pokaz mocy!"); },
    hasSelection: () => selectedIds.size > 0,
    onEscapeSelection: clearSelection,
    onUndo: () => {
      const done = undoLastAction();
      if (done) {
        toast.success(done.kind === "trash" ? "Cofnięto usunięcie" : "Cofnięto archiwizację", {
          description: done.label,
          icon: "↩️",
        });
      } else {
        toast("Nie ma czego cofać", { icon: "↩️" });
      }
    },
    onCloseSidebar: () => setSidebarOpen(false),
    isSidebarOpen: () => sidebarOpen,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onTogglePalette: () => setPaletteOpen((o) => !o),
  });

  const { handleImport } = useImportExport(importNotes, addNote);
  const externalImport = useExternalImport();

  // Callbacki podawane kartom czytają notatki przez ref — patrz `useLatestRef`.
  const notesRef = useLatestRef(notes);
  const archivedRef = useLatestRef(archivedNotes);
  const trashedRef = useLatestRef(trashedNotes);

  const handleRestoreVersion = useCallback((noteId: string, version: NoteVersion) => {
    const current = notesRef.current.find((n) => n.id === noteId);
    if (current?.locked) return;
    addVersion(noteId, current?.title || "", current?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notesRef, updateNote, addVersion]);

  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search: deferredSearch, prefs, propDefs,
  });

  useDayDoneReward(view === "today" && !search ? displayNotes : null);

  // Sekcje widoku: „Przypięte” (zwijane od 4 notatek) i reszta, opcjonalnie podzielona na grupy.
  // `visibleNotes` = to, co faktycznie jest na ekranie (bez zwiniętych) w kolejności widoku.
  // Tablica / tabela mają sens tylko w widokach z listą notatek (nie w agendzie, koszu, kalendarzu, grafiku).
  const listView = view !== "reminders" && view !== "trash" && view !== "calendar" && view !== "shifts" && view !== "study";
  const boardMode = prefs.layout === "board" && listView;
  const tableMode = prefs.layout === "table" && listView;
  // Kolumny tablicy potrzebują podziału: bez wybranego domyślnie idą po etykiecie.
  const groupBy: GroupBy = view === "reminders" || view === "trash" ? "none" : boardMode && prefs.groupBy === "none" ? "label" : prefs.groupBy;
  const showPinned = pinned.length > 0 && view !== "archive" && view !== "trash";
  const pinnedCollapsible = pinned.length > 3;
  const pinnedCollapsed = pinnedCollapsible && prefs.collapsedGroups.includes("pinned");
  const groups = useMemo(
    () => groupNotes(others, groupBy, { now: Date.now(), dateField: prefs.sortKey === "created" ? "createdAt" : "updatedAt", folders }),
    [others, groupBy, prefs.sortKey, folders],
  );
  const groupCollapsedKey = (key: string) => `${groupBy}:${key}`;
  const visibleNotes = useMemo(() => {
    const out = showPinned && !pinnedCollapsed ? [...pinned] : [];
    if (view === "reminders") return [...out, ...others];
    for (const g of groups) {
      if (groupBy === "none" || !prefs.collapsedGroups.includes(`${groupBy}:${g.key}`)) out.push(...g.notes);
    }
    return out;
  }, [showPinned, pinnedCollapsed, pinned, others, groups, groupBy, view, prefs.collapsedGroups]);
  const visibleNotesRef = useLatestRef(visibleNotes);

  // Notatki prywatne nie tworzą linków, tytułów do podpowiedzi ani backlinków.
  const allNotesForLinks = useMemo(() => [...notes, ...archivedNotes].filter((n) => !n.locked), [notes, archivedNotes]);
  // `knownTitles` i `wikiIndex` idą do każdej karty: zostawiamy ten sam obiekt,
  // dopóki tytuły i linki się nie zmienią (np. odhaczenie checklisty ich nie rusza).
  const titlesList = useMemo(
    () => [...new Set(allNotesForLinks.map((n) => n.title.trim().toLowerCase()).filter(Boolean))].sort(),
    [allNotesForLinks],
  );
  const freshKnownTitles = useMemo(() => new Set(titlesList), [titlesList]);
  const knownTitles = useStableByKey(freshKnownTitles, titlesList.join("\n"));
  const freshWikiIndex = useMemo(() => buildWikiIndex(allNotesForLinks), [allNotesForLinks]);
  const wikiIndex = useStableByKey(freshWikiIndex, wikiIndexKey(freshWikiIndex));
  const allNotesForLinksRef = useLatestRef(allNotesForLinks);
  /**
   * Jedno miejsce „pokaż tę notatkę”: przełącza na widok, w którym notatka
   * faktycznie jest (Notatki / Archiwum / Kosz), zdejmuje filtry, które mogłyby
   * ją ukryć, przewija do karty i na chwilę ją podświetla.
   */
  const revealNote = useCallback((id: string, target: View, viaLink: boolean, edit: boolean) => {
    setSearch("");
    if (viaLink) replaceWith(target); else go(target, { search: "" });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-note-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pierścień fokusu idzie za notatką — inaczej zostaje na kaflu z linkiem i świecą dwa naraz.
      setGridNavFocus(id);
      el.classList.add("note-flash");
      setTimeout(() => el.classList.remove("note-flash"), 1600);
      // Ta sama ścieżka co klik w kartę (patrz `NoteGrid` → `openNote`).
      if (edit) document.querySelector<HTMLElement>(`[data-note-id-wrap="${id}"] .cursor-pointer`)?.click();
    }, 150);
  }, [go, replaceWith]);
  /** Zapisany filtr: widok Notatki z jego zapytaniem w polu wyszukiwania. */
  const goFilter = useCallback((query: string) => {
    setSearch(query);
    go("notes", { search: query });
    if (isMobile) setSidebarOpen(false);
  }, [go, isMobile]);
  const openNote = useCallback((id: string, viaLink = false, edit = false) => {
    const note = [...notesRef.current, ...archivedRef.current, ...trashedRef.current].find((n) => n.id === id);
    if (!note) {
      toast.info("Tej notatki już nie ma");
      if (viaLink) replaceWith("notes");
      return;
    }
    const target: View = note.trashed ? "trash" : note.archived ? "archive" : "notes";
    if (target !== "notes") toast.info(target === "trash" ? "Notatka jest w Koszu" : "Notatka jest w Archiwum");
    revealNote(id, target, viaLink, edit && target !== "trash");
  }, [notesRef, archivedRef, trashedRef, replaceWith, revealNote]);
  // Hooki wołane wyżej w komponencie (powiadomienia) sięgają po najnowsze `openNote` przez ref.
  openNoteRef.current = openNote;

  /**
   * Notatka dnia: jest → otwórz ją w edytorze ze znacznikiem godziny na końcu;
   * nie ma → utwórz z szablonem dziennika. Rozpoznanie po `dailyDate`, nie tytule.
   */
  const openDailyNote = useCallback(() => {
    const now = Date.now();
    const key = dailyKey(now);
    const existing = findDailyNote([...notes, ...archivedNotes], key);
    if (existing) {
      // Przy otwartym edytorze szkic ma pierwszeństwo — nie dopisujemy mu pod ręką.
      // Notatka dnia zablokowana: nie dopisujemy do niej z jawnej (pustej) projekcji.
      if (!existing.locked && !isNoteTextEditOpen(existing.id)) updateNote(existing.id, { content: appendTimestamp(existing.content, now) });
      openNote(existing.id, false, true);
      return;
    }
    addLabel(DAILY_LABEL);
    const id = addNote(dailyTitle(now), DAILY_TEMPLATE, "lavender", [DAILY_LABEL]);
    updateNote(id, { dailyDate: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  // `/notatka/:id` (link, klik w powiadomienie): otwieramy dopiero po
  // wczytaniu bazy — wcześniej każda notatka wyglądałaby na usuniętą.
  const [notesLoaded, setNotesLoaded] = useState(false);
  useEffect(() => { whenNotesReady().then(() => setNotesLoaded(true)); }, []);
  useEffect(() => {
    if (route.noteId && notesLoaded) openNote(route.noteId, true);
  }, [route.noteId, notesLoaded, openNote]);

  const handleWikiClick = useCallback((raw: string) => {
    const { title, heading } = splitWikiTarget(raw);
    const target = allNotesForLinksRef.current.find((n) => n.title.trim().toLowerCase() === title.toLowerCase());
    if (!target) { toast.info(`Notatka „${title}" nie istnieje`); return; }
    if (heading && !target.locked) {
      // Do nagłówka przewija czytnik, więc notatka otwiera się w podglądzie.
      requestHeading(heading);
      setPresentingNoteId(null);
      setGridNavPreview(target.id);
    } else openNote(target.id);
  }, [allNotesForLinksRef, openNote]);

  // Czytnik: podgląd (Spacja na kaflu, stan w `gridKeyboardNav`) albo prezentacja.
  const previewId = useGridNavPreviewId();
  const readerId = presentingNoteId ?? previewId;
  const readerNote = useMemo(
    // Czytnik, prezentacja i podgląd nie otwierają notatek prywatnych (nie ma jak ich bezpiecznie pokazać).
    () => (readerId ? [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === readerId && !n.locked) ?? null : null),
    [readerId, notes, archivedNotes, trashedNotes],
  );
  // „Bieżąca” notatka dla palety poleceń: otwarta w czytniku, jedyna zaznaczona albo z fokusem.
  // Fokus siatki czytamy tylko po otwarciu palety — subskrypcja przerysowywałaby
  // całą stronę przy każdej strzałce (patrz selektory w `gridKeyboardNav`).
  const copyTarget = useMemo(() => {
    if (!paletteOpen) return null;
    const id = readerId ?? (selectedIds.size === 1 ? [...selectedIds][0] : getGridNavFocusedId());
    return id ? [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === id && !n.locked) ?? null : null;
  }, [paletteOpen, readerId, selectedIds, notes, archivedNotes, trashedNotes]);
  const closeReader = useCallback(() => { setPresentingNoteId(null); setGridNavPreview(null); }, []);
  const showInReader = useCallback((id: string, mode: ReaderMode) => {
    if (mode === "present") { setGridNavPreview(null); setPresentingNoteId(id); }
    else { setPresentingNoteId(null); setGridNavPreview(id); }
  }, []);
  const editFromReader = useCallback((id: string) => {
    closeReader();
    // Kafel musi najpierw wrócić na wierzch po zamknięciu czytnika.
    setTimeout(() => openNote(id, false, true), 50);
  }, [closeReader, openNote]);

  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
        const ids = visibleNotesRef.current.map((n) => n.id);
        const a = ids.indexOf(lastSelectedRef.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastSelectedRef.current = id;
      return next;
    });
  }, [visibleNotesRef]);

  // Czytnik/prezentacja też liczy się jako „otwarcie” (sortowanie „Ostatnio otwierane”).
  useEffect(() => { if (readerId) markNoteOpened(readerId); }, [readerId]);

  // Ctrl/Cmd+A poza polami tekstowymi: zaznacza wszystko, co widać (bez zwiniętych sekcji).
  useEffect(() => {
    if (view === "calendar" || view === "shifts" || view === "study") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "a") return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]') || previewId || presentingNoteId) return;
      const ids = visibleNotesRef.current.map((n) => n.id);
      if (ids.length === 0) return;
      e.preventDefault();
      setSelectedIds(new Set(ids));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, previewId, presentingNoteId, visibleNotesRef]);

  // Undo fallbacks so history restored from localStorage stays actionable after reload
  useEffect(() => {
    registerUndoHandlers({
      trash: (ids) => bulkRestore(ids),
      archive: (ids) => ids.forEach(unarchiveNote),
    });
  }, [bulkRestore, unarchiveNote]);

  const {
    handleTrashSingle, handleArchiveSingle, handleBulkTrash, handleBulkArchive, handleBulkColor, handleSelectAll,
  } = useNoteActions({
    notes, archivedNotes, selectedIds, confirmAction, clearSelection,
    trashNote, restoreFromTrash, archiveNote, unarchiveNote,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore, setSelectedIds, displayNotes: visibleNotes,
  });

  // Notatka tworzona w folderze albo w widoku etykiety ląduje tam, gdzie
  // użytkownik patrzy — inaczej znika mu z oczu i wymaga przeciągnięcia.
  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar]"));
    if (p) glowPulse(p, "create", 260);
    const [title, content, color, labels = [], reminder, images, checklist, priority, folderId, attachments] = args;
    const withLabel = activeLabel && !labels.includes(activeLabel) ? [...labels, activeLabel] : labels;
    const inFolder = folderId ?? (view === "folder" ? activeFolder : null);
    return addNote(title, content, color, withLabel, reminder, images, checklist, priority, inFolder, attachments);
  }, [addNote, activeLabel, activeFolder, view]);

  /** Dodanie z paska: potwierdzenie z „Cofnij” (tylko tu — szablony i udostępnianie mają swoje komunikaty). */
  const handleComposerAdd = useCallback((...args: [...Parameters<typeof addNote>, extras?: ComposerExtras]) => {
    const extras = args.length > 10 ? (args[10] as ComposerExtras | undefined) : undefined;
    const id = handleAddNoteGlow(...(args.slice(0, 10) as Parameters<typeof addNote>));
    // Seria przypomnienia i rodzic nie mieszczą się w `addNote` — dopisujemy je zaraz po utworzeniu.
    if (extras?.reminderRepeat || extras?.parentId) {
      updateNote(id, {
        ...(extras.reminderRepeat ? { reminderRepeat: extras.reminderRepeat } : {}),
        ...(extras.reminderRepeatUntil !== undefined ? { reminderRepeatUntil: extras.reminderRepeatUntil } : {}),
        ...(extras.parentId ? { parentId: extras.parentId } : {}),
      });
    }
    toastWithUndo("Dodano notatkę", () => deleteNote(id), { icon: "📝", duration: 4000, id: "composer-added" });
    return id;
  }, [handleAddNoteGlow, updateNote, deleteNote]);

  /** Kandydaci na rodzica w pasku nowej notatki: jawne, żywe notatki, od ostatnio edytowanych. */
  const composerParents = useMemo(
    () => [...notes].filter((n) => !n.locked && !n.archived && !n.trashed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200).map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  const handleMoveToFolderGlow = useCallback((id: string, folderId: string | null) => {
    const from = pointOfNote(id);
    const target = folderId
      ? document.querySelector(`[data-folder-drop="${folderId}"]`)
      : document.querySelector("[data-folder-drop-root]");
    const to = centerOf(target);
    if (from && to) glowStreak(from, to, "move");
    else if (from) glowPulse(from, "move");
    moveNoteToFolder(id, folderId);
  }, [moveNoteToFolder]);

  // Entry points from manifest.webmanifest: home-screen shortcuts "Nowa notatka"
  // (?new=1), "Nowa lista" (?new=list), "Szukaj" (?szukaj=1) and Web Share Target (?share-title/-text/-url=, from "Share" on
  // another app once the app is installed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = parseShare(window.location.pathname, window.location.search);
    if (shared) {
      // Adres czyścimy od razu — odświeżenie nie ma co powtarzać; `claimShare`
      // łapie jeszcze przypadek odświeżenia, zanim router zdążył zamienić wpis.
      navigate("/", { replace: true });
      if (claimShare(shared)) {
        void whenNotesReady().then(() => {
          const id = handleAddNoteGlow(shared.title, shared.content);
          toast.success("Zapisano w NOTKACH", { action: { label: "Otwórz", onClick: () => openNoteRef.current(id) } });
        });
      }
    } else if (window.location.pathname === SHARE_PATH) {
      // Pusty `/share` (np. ręcznie wpisany adres) — po prostu wróć do Notatek.
      navigate("/", { replace: true });
    } else if (params.get("new")) {
      // Skrót „Nowa lista” (`?new=list`) otwiera kompozytor od razu w trybie listy.
      expandAddNote(params.get("new") === "list" ? "list" : undefined);
      window.history.replaceState(null, "", window.location.pathname);
    } else if (params.get("szukaj")) {
      // Skrót „Szukaj”: kursor w polu wyszukiwania (widocznym — na telefonie i komputerze to inne pola).
      // Bez gestu iOS nie otworzy klawiatury; Android tak.
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(() => {
        const input = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find((el) => el.offsetParent !== null);
        input?.focus();
      }, 300);
    }
    // Intentionally once on mount: reads the URL this load started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Licznik w pasku bocznym tylko przy tym, co wymaga uwagi: zaległe przypomnienia i Kosz.
  // Ta sama liczba ląduje w tytule karty i na ikonie aplikacji (useOverdueBadge).
  const overdueCount = useOverdueBadge(notes);
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby
  // w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = useCallback((id: string) => { deleteNote(id); deleteVersions(id); }, [deleteNote, deleteVersions]);
  const handleDelete = view === "trash" ? deleteNoteForever : handleTrashSingle;

  /** Zaznaczone w Koszu wracają do notatek, w Archiwum — z archiwum; oba z „Cofnij”. */
  const handleBulkRestoreView = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (view === "trash") {
      bulkRestore(ids);
      clearSelection();
      toastWithUndo(`Przywrócono ${ids.length} z kosza`, () => bulkTrash(ids));
    } else {
      ids.forEach(unarchiveNote);
      clearSelection();
      toastWithUndo(`Przywrócono ${ids.length} z archiwum`, () => bulkArchive(ids));
    }
  }, [selectedIds, view, bulkRestore, bulkTrash, bulkArchive, unarchiveNote, clearSelection]);

  const { sensors, setDraggingNoteId, handleDragStart, handleDragEnd } = useNoteDnd({
    displayNoteIds: displayNotes.map((n) => n.id),
    folders,
    moveNoteToFolder: handleMoveToFolderGlow,
    reorderNotes,
    selectedIds,
    clearSelection,
    folderOf: (id) => notesRef.current.find((n) => n.id === id)?.folderId ?? null,
    board: boardMode
      ? {
          columnOf: (id) => {
            const n = notesRef.current.find((x) => x.id === id);
            return n ? columnOfNote(n, groupBy) : undefined;
          },
          onMove: (ids, key) => moveToColumn(ids, key),
        }
      : undefined,
  });

  /** Zbiorcze: przypnij / odepnij zaznaczone (jeśli któraś jest nieprzypięta — przypina wszystkie). */
  function handleBulkPin() {
    const chosen = notesRef.current.filter((n) => selectedIds.has(n.id));
    if (chosen.length === 0) return;
    const pin = chosen.some((n) => !n.pinned);
    const changed = chosen.filter((n) => n.pinned !== pin).map((n) => n.id);
    changed.forEach((id) => togglePin(id));
    clearSelection();
    toastWithUndo(`${pin ? "Przypięto" : "Odpięto"} ${changed.length}`, () => changed.forEach((id) => togglePin(id)), { icon: "📌" });
  }

  /** Zbiorcze: przenieś zaznaczone do folderu (`null` = bez folderu), z „Cofnij”. */
  function handleBulkMoveToFolder(folderId: string | null) {
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && n.folderId !== folderId).map((n) => [n.id, n.folderId] as const);
    if (prev.length === 0) { clearSelection(); return; }
    prev.forEach(([id]) => handleMoveToFolderGlow(id, folderId));
    clearSelection();
    const name = folderId ? folders.find((f) => f.id === folderId)?.name ?? "folder" : "Bez folderu";
    toastWithUndo(`Przeniesiono ${prev.length} do „${name}”`, () => prev.forEach(([id, from]) => handleMoveToFolderGlow(id, from)), { icon: "📁" });
  }

  /** Zbiorcze: dodaj etykietę do zaznaczonych (istniejące zostają), z „Cofnij”. */
  function handleBulkAddLabel(label: string) {
    const name = label.trim().replace(/^#/, "");
    if (!name) return;
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && !n.labels.includes(name)).map((n) => [n.id, n.labels] as const);
    if (prev.length === 0) { clearSelection(); return; }
    addLabel(name);
    prev.forEach(([id, labels]) => updateNote(id, { labels: [...labels, name] }));
    clearSelection();
    toastWithUndo(`Dodano #${name} do ${prev.length}`, () => prev.forEach(([id, labels]) => updateNote(id, { labels })), { icon: "🏷️" });
  }

  /** Przeniesienie kart do kolumny tablicy: przypięcie, etykieta albo folder — z „Cofnij”. */
  function moveToColumn(ids: string[], key: string) {
    if (groupBy === "date") {
      toast.message("Kolumny wg daty wynikają z czasu edycji", { description: "Wybierz podział wg etykiety lub folderu, by przenosić karty." });
      return;
    }
    const prev = ids
      .map((id) => notesRef.current.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ id: n.id, pinned: n.pinned, labels: n.labels, folderId: n.folderId }));
    const apply = (id: string, target: { pinned: boolean; labels: string[]; folderId: string | null }) => {
      const cur = notesRef.current.find((n) => n.id === id);
      if (!cur) return;
      if (cur.pinned !== target.pinned) togglePin(id);
      if (groupBy === "label" && cur.labels.join("\n") !== target.labels.join("\n")) updateNote(id, { labels: target.labels });
      if (groupBy === "folder" && cur.folderId !== target.folderId) handleMoveToFolderGlow(id, target.folderId);
    };
    prev.forEach((n) => {
      if (key === PINNED_COLUMN) apply(n.id, { ...n, pinned: true });
      else if (groupBy === "label") apply(n.id, { ...n, pinned: false, labels: labelsForColumn(n.labels, key) });
      else apply(n.id, { ...n, pinned: false, folderId: key === NONE_COLUMN ? null : key });
    });
    const label = key === PINNED_COLUMN ? "Przypięte" : key === NONE_COLUMN ? (groupBy === "label" ? "Bez etykiety" : "Bez folderu") : groupBy === "label" ? `#${key}` : folders.find((f) => f.id === key)?.name ?? "folder";
    toastWithUndo(prev.length > 1 ? `Przeniesiono do „${label}” (${prev.length})` : `Przeniesiono do „${label}”`, () => prev.forEach((n) => apply(n.id, n)), { icon: "🗂️" });
  }

  const renderGrid = (gridNotes: typeof displayNotes, navOrder: number) => (
    <NoteGrid
      navOrder={navOrder}
      notes={gridNotes}
      onUpdate={view === "trash" ? undefined : updateNote}
      onDelete={handleDelete}
      onTogglePin={view === "trash" ? undefined : togglePin}
      onDuplicate={view === "trash" ? undefined : duplicateNote}
      onArchive={view === "archive" ? undefined : view === "trash" ? undefined : handleArchiveSingle}
      onUnarchive={view === "archive" ? unarchiveNote : view === "trash" ? restoreFromTrash : undefined}
      isArchived={view === "archive" || view === "trash"}
      onMoveToFolder={view === "trash" ? undefined : handleMoveToFolderGlow}
      getVersions={getVersions}
      onSaveVersion={addVersion}
      onRestoreVersion={handleRestoreVersion}
      onPresent={setPresentingNoteId}
      knownTitles={knownTitles}
      onWikiClick={handleWikiClick}
      wikiIndex={wikiIndex}
      onOpenNote={openNote}
      selectedIds={selectedIds}
      selectionMode={selectionMode}
      onToggleSelect={toggleSelect}
    />
  );

  const sidebarItems: { icon: React.ElementType; label: string; view: View; count?: number; alert?: boolean; emoji: string }[] = [
    { icon: StickyNote, label: "Notatki", view: "notes", emoji: "📝" },
    { icon: Calendar, label: "Dziś", view: "today", emoji: "📅" },
    { icon: Bell, label: "Przypomnienia", view: "reminders", count: overdueCount, alert: true, emoji: "🔔" },
    { icon: CalendarRange, label: "Kalendarz", view: "calendar", emoji: "🗓️" },
    { icon: BriefcaseBusiness, label: "Grafik", view: "shifts", emoji: "🗂️" },
    { icon: HardHat, label: "Praca", view: "study", emoji: "👷" },
    { icon: Archive, label: "Archiwum", view: "archive", emoji: "📦" },
    { icon: Trash, label: "Kosz", view: "trash", count: trashedNotes.length, emoji: "🗑️" },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingNoteId(null)}>
    <PaperBackdrop />
    <div className="min-h-screen flex relative">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        view={view}
        activeLabel={activeLabel}
        activeFolder={activeFolder}
        onGoView={(v) => { go(v); if (isMobile) setSidebarOpen(false); }}
        onOpenNote={(id) => { openNote(id); if (isMobile) setSidebarOpen(false); }}
        onGoLabel={(label) => { go("label", { label }); if (isMobile) setSidebarOpen(false); }}
        onGoFolder={(id) => { go("folder", { folder: id }); if (isMobile) setSidebarOpen(false); }}
        onGoFilter={goFilter}
        search={search}
        sidebarItems={sidebarItems}
        onLogoClick={handleLogoClick}
        dark={dark}
        onToggleTheme={toggleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenActions={() => setActionsOpen(true)}
        onOpenStats={() => setStatsOpen(true)}
        onOpenFocusMode={() => setFocusModeOpen(true)}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          selectionMode={selectionMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          dark={dark}
          onToggleTheme={toggleTheme}
          view={view}
          activeFolder={activeFolder}
          activeLabel={activeLabel}
          displayCount={displayNotes.length}
          search={search}
          onSearchChange={setSearch}
          onImport={handleImport}
        />

        {/* `flex gap`, nie `space-y`: ukryta na sm+ wyszukiwarka nie dokłada marginesu nad treścią. */}
        <main ref={mainRef} className="flex-1 max-w-352 mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 pb-safe">
          {view !== "shifts" && view !== "calendar" && view !== "study" && (
            <div data-view-static className="sm:hidden">
              <SearchBar value={search} onChange={setSearch} />
            </div>
          )}
          {view === "notes" && <InstallBanner ready={notes.length >= 3} />}
          {view === "today" && !deferredSearch && (
            <Suspense fallback={null}>
              <WeeklyReviewCard
                notes={notes} folders={folders} onOpen={openNote} onTogglePin={togglePin}
                onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow}
                archiveNote={archiveNote} unarchiveNote={unarchiveNote} trashNote={trashNote} restoreFromTrash={restoreFromTrash}
              />
            </Suspense>
          )}

          {canCompose && (
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={tween.enter}
              // Zwinięty pasek jest pod `md` schowany — pusty pojemnik dokładał drugi odstęp `gap` nad notatkami (~50 px).
              className="space-y-3 max-md:[&:not(:has([data-composer-open]))]:hidden">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleComposerAdd} wikiTitles={wikiIndex.titles} parentOptions={composerParents} folders={folders} allLabels={allLabels} onCreateLabel={addLabel} destination={composeDestination}
                  templates={(done) => (
                    <QuickTemplates
                      onPick={(...args) => { done(); handleAddNoteGlow(...args); }}
                      onCreateLabel={addLabel}
                      onDailyNote={() => { done(); openDailyNote(); }}
                    />
                  )}
                />
              </div>
            </motion.div>
          )}

          {view === "trash" && trashedNotes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4 px-1">
              <p className="text-xs text-muted-foreground">Notatki w koszu są automatycznie usuwane po 30 dniach</p>
              <button
                onClick={() => setConfirmEmptyTrash(true)}
                className="pressable text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Opróżnij kosz
              </button>
            </motion.div>
          )}

          <AlertDialog open={confirmDeleteIds !== null} onOpenChange={(o) => { if (!o) setConfirmDeleteIds(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Usunąć trwale?</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmDeleteIds?.length ?? 0} {(confirmDeleteIds?.length ?? 0) === 1 ? "notatka zostanie" : "notatki zostaną"} trwale usunięte. Tej operacji nie można cofnąć.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const ids = confirmDeleteIds ?? [];
                    ids.forEach(deleteNoteForever);
                    clearSelection();
                    toast.success(`Usunięto trwale: ${ids.length}`);
                    setConfirmDeleteIds(null);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Usuń trwale
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={confirmEmptyTrash} onOpenChange={setConfirmEmptyTrash}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Opróżnić kosz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wszystkie {trashedNotes.length} {trashedNotes.length === 1 ? "notatka zostanie" : "notatki zostaną"} trwale usunięte. Tej operacji nie można cofnąć.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { deleteVersions(trashedNotes.map((n) => n.id)); emptyTrash(); toast.success("Kosz opróżniony"); setConfirmEmptyTrash(false); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Opróżnij
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {showPinned && !boardMode && !tableMode && (
            <NoteGroupSection
              groupKey="pinned"
              label="📌 Przypięte"
              count={pinned.length}
              collapsible={pinnedCollapsible}
              collapsed={pinnedCollapsed}
              onToggle={() => toggleGroupCollapsed("pinned")}
            >
              <NoteGrid navOrder={0} notes={pinned} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} onPresent={setPresentingNoteId} knownTitles={knownTitles} onWikiClick={handleWikiClick} wikiIndex={wikiIndex} onOpenNote={openNote} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
            </NoteGroupSection>
          )}

          {view === "reminders" && groupReminders(others).map((group, i) => (
            <NoteGroupSection key={group.key} groupKey={`reminders-${group.key}`} label={group.label} count={group.notes.length} tone={group.key === "overdue" ? "alert" : "default"}>
              <NoteGrid navOrder={i} notes={group.notes} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} onPresent={setPresentingNoteId} knownTitles={knownTitles} onWikiClick={handleWikiClick} wikiIndex={wikiIndex} onOpenNote={openNote} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
            </NoteGroupSection>
          ))}

          {view !== "reminders" && !boardMode && !tableMode && groups.map((group, gi) => {
            const grid = (navOrder: number) => renderGrid(group.notes, navOrder);
            // Bez podziału: jedna sekcja jak dotąd („Inne” tylko pod przypiętymi).
            if (groupBy === "none") {
              return showPinned ? (
                <NoteGroupSection key="others" groupKey="others" label="Inne" count={group.notes.length}>
                  {grid(1)}
                </NoteGroupSection>
              ) : (
                <section key="others">{grid(1)}</section>
              );
            }
            // Kolejność sekcji = kolejność nawigacji klawiaturą; zwinięta nie renderuje siatki, więc jest pomijana.
            return (
              <NoteGroupSection
                key={`${groupBy}:${group.key}`}
                groupKey={`${groupBy}-${group.key}`}
                label={group.label}
                count={group.notes.length}
                collapsible
                collapsed={prefs.collapsedGroups.includes(groupCollapsedKey(group.key))}
                onToggle={() => toggleGroupCollapsed(groupCollapsedKey(group.key))}
              >
                {grid(gi + 1)}
              </NoteGroupSection>
            );
          })}

          {boardMode && (
            <NoteBoard
              headers={[
                ...(showPinned ? [{ key: PINNED_COLUMN, label: "📌 Przypięte", count: pinned.length }] : []),
                ...groups.map((group) => ({ key: group.key || NONE_COLUMN, label: group.label, count: group.notes.length })),
              ]}
            >
              {showPinned && (
                <BoardColumn columnKey={PINNED_COLUMN} label="📌 Przypięte" count={pinned.length}>
                  {renderGrid(pinned, 0)}
                </BoardColumn>
              )}
              {groups.map((group, gi) => (
                <BoardColumn key={`${groupBy}:${group.key}`} columnKey={group.key || NONE_COLUMN} label={group.label} count={group.notes.length} droppable={groupBy !== "date"}>
                  {renderGrid(group.notes, gi + 1)}
                </BoardColumn>
              ))}
            </NoteBoard>
          )}

          {tableMode && (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPropDefsOpen(true)}
                  className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted"
                >
                  Pola{propDefs.length ? ` (${propDefs.length})` : ""}
                </button>
              </div>
              <NoteTable
                notes={[...(showPinned ? pinned : []), ...others]}
                folders={folders}
                sortKey={prefs.sortKey}
                sortDir={prefs.sortDir}
                selectedIds={selectedIds}
                onOpen={(id) => showInReader(id, "preview")}
                propDefs={propDefs}
                onUpdate={updateNote}
              />
            </>
          )}

          {view === "calendar" && (
            <ViewErrorBoundary name="Kalendarz">
              <Suspense fallback={<ViewSkeleton view="calendar" />}>
                <ReminderCalendarView
                  notes={[...notes, ...archivedNotes]}
                  onCreateNote={(title, reminder, repeat) => {
                    const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
                    // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy
                    // patchem po utworzeniu — stąd id zwracane przez `addNote`.
                    if (repeat !== "none") updateNote(id, { reminderRepeat: repeat });
                  }}
                  onSetReminder={(id, reminder, repeat, reminderDay) =>
                    updateNote(id, reminderDay === undefined ? { reminder, reminderRepeat: repeat } : { reminder, reminderRepeat: repeat, reminderDay })}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "study" && (
            <ViewErrorBoundary name="Praca">
              <Suspense fallback={<ViewSkeleton view="study" />}>
                <StudyView />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "shifts" && (
            <ViewErrorBoundary name="Grafik">
              <Suspense fallback={<ViewSkeleton view="shifts" />}>
                <ShiftsView notes={[...notes, ...archivedNotes]} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {/* Liczba wyników dla czytnika ekranu — lista zmienia się bez żadnego komunikatu. */}
          <p role="status" aria-live="polite" className="sr-only">
            {deferredSearch && view !== "calendar" && view !== "shifts" && view !== "study" ? `${displayNotes.length} ${pluralPl(displayNotes.length, ["wynik", "wyniki", "wyników"])}` : ""}
          </p>
          {view !== "calendar" && view !== "shifts" && view !== "study" && displayNotes.length === 0 && <EmptyState view={view} search={deferredSearch} elsewhere={elsewhere} onGo={(v) => go(v)} />}
          {view === "notes" && displayNotes.length > 0 && !deferredSearch && <DailyQuote />}
        </main>
      </div>
    </div>

    {paletteOpen && (
      <Suspense fallback={null}>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          notes={[...notes, ...archivedNotes]}
          onOpenNote={openNote}
          onNewNote={expandAddNote}
          onDailyNote={openDailyNote}
          onGo={(v) => go(v)}
          onGoFilter={goFilter}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onOpenFocusMode={() => setFocusModeOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onCopyNote={copyTarget ? (fmt) => { void copyNoteToClipboard(copyTarget, fmt); } : undefined}
        />
      </Suspense>
    )}
    <AchievementStamp />
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
    <AnimatePresence>
      {readerNote && (
        <NoteReader
          key="reader"
          note={readerNote}
          mode={presentingNoteId ? "present" : "preview"}
          searchQuery={search}
          knownTitles={knownTitles}
          wikiIndex={wikiIndex}
          onClose={closeReader}
          onEdit={editFromReader}
          onShow={showInReader}
          resolveTitle={(title) => resolveWikiTarget(title, allNotesForLinks)?.id}
          propDefs={propDefs}
          onUpdateProps={updateNote}
          onToggleChecklist={(noteId, itemId) => {
            const n = [...notes, ...archivedNotes].find((x) => x.id === noteId);
            if (!n) return;
            updateNote(noteId, { checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)) });
          }}
        />
      )}
    </AnimatePresence>
    {focusModeOpen && (
      <Suspense fallback={null}>
        <FocusMode
          open={focusModeOpen}
          onOpenChange={setFocusModeOpen}
          onSave={(title, content) => { addNote(title, content); toast.success("Zapisano notatkę 🧠"); }}
        />
      </Suspense>
    )}
    <BottomNav
      view={view}
      onGo={(v) => go(v)}
      onNew={(action) => expandAddNote(action)}
      onImport={handleImport}
      onGoFilter={goFilter}
      search={search}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenActions={() => setActionsOpen(true)}
      trashCount={trashedNotes.length}
      dark={dark}
      onToggleTheme={toggleTheme}
    />
    <BulkActionBar
      count={selectedIds.size}
      totalVisible={visibleNotes.length}
      onSelectAll={handleSelectAll}
      onClear={clearSelection}
      onArchive={handleBulkArchive}
      onTrash={handleBulkTrash}
      onColor={handleBulkColor}
      folders={folders}
      allLabels={allLabels}
      onPin={handleBulkPin}
      onMoveToFolder={handleBulkMoveToFolder}
      onAddLabel={handleBulkAddLabel}
      view={view === "trash" ? "trash" : view === "archive" ? "archive" : "other"}
      onRestore={handleBulkRestoreView}
      onDeleteForever={() => setConfirmDeleteIds(Array.from(selectedIds))}
      onExport={() => {
        const ids = selectedIds;
        const chosen = [...notes, ...archivedNotes, ...trashedNotes].filter((n) => ids.has(n.id));
        const zip = downloadNotesZip(chosen, folders, `notatki-${new Date().toISOString().slice(0, 10)}.zip`, propDefs);
        toast.success(`Pobrano ${zip.count} ${zip.count === 1 ? "notatkę" : "notatek"} (ZIP z plikami .md)`, {
          description: zip.skippedPrivate ? `Pominięto ${zip.skippedPrivate} prywatnych — ich treść jest zaszyfrowana.` : "Bez obrazów i załączników. Da się je wczytać z powrotem przez Importuj → Markdown.",
        });
      }}
    />
    <Suspense fallback={null}>
      <OnboardingTour />
    </Suspense>
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
    {confirmDialog}
    <VaultHost />
    </DndContext>
  );
};

export default Index;
