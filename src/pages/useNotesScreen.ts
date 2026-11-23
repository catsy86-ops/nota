import { useCallback, useMemo, useRef, type MutableRefObject } from "react";
import { isAppView } from "@/lib/viewMeta";
import type { Note, Folder, NoteColor } from "@/hooks/useNotes";
import type { View } from "@/lib/types/view";
import type { ViewPrefs } from "@/lib/viewPrefs";
import type { PropDef } from "@/lib/noteProps";
import { useFilteredNotes } from "@/hooks/useFilteredNotes";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useNextBoundary } from "@/hooks/useNextBoundary";
import { countDueToday, groupReminders, sortArchivedByReminder } from "@/lib/reminderAgenda";
import { searchNotes, useSearchVersion } from "@/lib/searchNotes";
import { groupNotes, type GroupBy } from "@/lib/groupNotes";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useBulkNoteOps } from "@/hooks/useBulkNoteOps";
import { useNoteExport } from "@/hooks/useNoteExport";
import type { useSelection } from "@/hooks/useSelection";
import type { useConfirmAction } from "@/components/ConfirmActionDialog";
import type { ComposerAction } from "@/components/AddNoteBar";
import { repeatUpdate, toRule, type RepeatInput } from "@/lib/reminderRepeat";

/**
 * A2.3: model listy notatek z `Index` (mapa w `docs/index-mapa.md`, grupy „Filtr i widok” i „Terminy”).
 * Liczy to, co widać: filtr, tryb układu, sekcje (przypięte + grupy), `visibleNotes` w kolejności nawigacji klawiaturą
 * oraz wiersze Terminów. Bez stanu własnego — wszystko wynika z danych, trasy i `prefs`.
 */
export interface NotesScreenArgs {
  notes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  folders: Folder[];
  propDefs: PropDef[];
  view: View;
  activeLabel: string | null;
  activeFolder: string | null;
  /** Odroczone zapytanie i ustawienia (3.4): lista nadrabia, pasek reaguje od razu. */
  deferredSearch: string;
  deferredPrefs: ViewPrefs;
  /** Bieżące ustawienia — zwinięte grupy, sortowanie i układ czytamy bez odroczenia, jak dotąd. */
  prefs: ViewPrefs;
}

export function useNotesScreen({ notes, archivedNotes, trashedNotes, folders, propDefs, view, activeLabel, activeFolder, deferredSearch, deferredPrefs, prefs }: NotesScreenArgs) {
  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search: deferredSearch, prefs: deferredPrefs, propDefs,
  });
  // Stabilna tablica: nowa w każdym renderze restartowałaby sprawdzanie przypomnień przy każdym znaku w wyszukiwarce.
  const reminderNotes = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);

  // W Terminach archiwum zostaje w liście (dzwoni), więc „Brak przypomnień” nie może mówić prawdy tylko o `displayNotes` (1d planu).
  // Archiwum nie wchodzi do grup „Zaległe”/„Nadchodzące” (D4): ma własną sekcję na dole, z wyszukiwaniem.
  // T 1.1: grupy przeliczają się na granicy terminu i o północy, nie tylko przy zmianie notatek.
  const boundaryTick = useNextBoundary(others);
  // `boundaryTick` wymusza przeliczenie na granicy terminu (groupReminders czyta bieżący czas).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reminderGroups = useMemo(() => (view === "reminders" ? groupReminders(others) : []), [view, others, boundaryTick]);
  const searchVersion = useSearchVersion();
  const archivedRows = useMemo(
    // T 1.6: archiwum po terminie jak grupy — z terminem rosnąco, bez terminu na końcu.
    () => (view === "reminders" ? (deferredSearch ? searchNotes(archivedNotes, deferredSearch) : sortArchivedByReminder(archivedNotes)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchVersion`: przeliczenie po odpowiedzi Workera wyszukiwania
    [view, deferredSearch, archivedNotes, searchVersion],
  );
  // Na „Dziś” liczą się zaległe i dzisiejsze przypomnienia, żeby „Brak notatek z dzisiaj” nie stał obok ich listy.
  // Bez `useMemo`: Index i tak renderuje się po północy (useOverdueBadge → useDayClock).
  const reminderRowCount = view === "reminders"
    ? reminderGroups.reduce((n, g) => n + g.notes.length, 0) + archivedRows.length
    : view === "today" ? countDueToday(reminderNotes) : 0;

  // Tablica / tabela / galeria mają sens tylko w widokach z listą notatek (nie w agendzie, koszu, kalendarzu, grafiku).
  const listView = view !== "reminders" && view !== "trash" && !isAppView(view) && view !== "widget";
  const boardMode = prefs.layout === "board" && listView;
  const tableMode = prefs.layout === "table" && listView;
  const galleryMode = prefs.layout === "gallery" && listView;
  // Kolumny tablicy potrzebują podziału: bez wybranego domyślnie idą po etykiecie.
  const groupBy: GroupBy = view === "reminders" || view === "trash" ? "none" : boardMode && prefs.groupBy === "none" ? "label" : prefs.groupBy;
  // „Przypięte” (zwijane od 4 notatek) i reszta, opcjonalnie podzielona na grupy.
  const showPinned = pinned.length > 0 && view !== "archive" && view !== "trash";
  const pinnedCollapsible = pinned.length > 3;
  const pinnedCollapsed = pinnedCollapsible && prefs.collapsedGroups.includes("pinned");
  const groups = useMemo(
    () => groupNotes(others, groupBy, { now: Date.now(), dateField: prefs.sortKey === "created" ? "createdAt" : "updatedAt", folders }),
    [others, groupBy, prefs.sortKey, folders],
  );
  // `visibleNotes` = to, co faktycznie jest na ekranie (bez zwiniętych) w kolejności widoku.
  const visibleNotes = useMemo(() => {
    const out = showPinned && !pinnedCollapsed ? [...pinned] : [];
    if (view === "reminders") return [...out, ...others];
    for (const g of groups) {
      if (groupBy === "none" || !prefs.collapsedGroups.includes(`${groupBy}:${g.key}`)) out.push(...g.notes);
    }
    return out;
  }, [showPinned, pinnedCollapsed, pinned, others, groups, groupBy, view, prefs.collapsedGroups]);
  const visibleNotesRef = useLatestRef(visibleNotes);

  return {
    displayNotes, pinned, others, elsewhere, reminderNotes,
    reminderGroups, archivedRows, reminderRowCount,
    boardMode, tableMode, galleryMode, groupBy,
    showPinned, pinnedCollapsible, pinnedCollapsed, groups, visibleNotes, visibleNotesRef,
  };
}

type AddNote = (title: string, content: string, color?: NoteColor, labels?: string[], reminder?: number | null) => string;
type UpdateNote = (id: string, patch: Partial<Note>) => void;

/**
 * Zapis terminów wspólny dla Terminów (dialog „Nowy termin”) i Kalendarza — wcześniej dwie równoważne kopie w `Index`.
 * `addNote` nie przyjmuje powtarzania, więc serię dostawiamy patchem po utworzeniu.
 */
export function reminderWriters(addNote: AddNote, updateNote: UpdateNote, color: NoteColor) {
  const createReminderNote = (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => {
    const id = addNote(title, "", color, [], reminder);
    const repeats = toRule(repeat).kind !== "none";
    if (repeats || allDay) updateNote(id, { ...repeatUpdate(repeat), ...(repeats && until !== undefined ? { reminderRepeatUntil: until } : {}), ...(allDay ? { reminderAllDay: true } : {}) });
  };
  // Koniec serii idzie z wywołania (K0.4). Bez powtarzania czyścimy go, żeby nie wrócił przy następnej serii.
  const setReminder = (id: string, reminder: number | null, repeat: RepeatInput, reminderDay?: number, reminderBase?: number, reminderAllDay?: boolean, until?: number) =>
    updateNote(id, { reminder, ...repeatUpdate(repeat), reminderRepeatUntil: toRule(repeat).kind === "none" ? undefined : until, ...(reminderDay === undefined ? {} : { reminderDay }), reminderBase, reminderAllDay: reminderAllDay === true ? true : undefined });
  const attachReminder = (id: string, reminder: number, repeat: RepeatInput, allDay: boolean, base: number | undefined, until?: number) =>
    setReminder(id, reminder, repeat, undefined, base, allDay, until);
  return { createReminderNote, setReminder, attachReminder };
}

/**
 * A2.3: kompozytor nowej notatki. Pasek dodawania jest też w folderze, etykiecie i Dziś (2.5) — nowa notatka dziedziczy
 * ten kontekst (`handleAddNoteGlow`), zamiast lądować poza widokiem.
 */
export function useComposer({ view, activeFolder, activeLabel, folders, setView }: {
  view: View; activeFolder: string | null; activeLabel: string | null; folders: Folder[]; setView: (v: View) => void;
}) {
  const addNoteRef = useRef<{ expand: (action?: ComposerAction, prefill?: string) => void }>(null);
  const canCompose = view === "notes" || view === "today" || (view === "folder" && !!activeFolder) || (view === "label" && !!activeLabel);
  const composeDestination = view === "folder"
    ? folders.find((f) => f.id === activeFolder)?.name ?? null
    : view === "label" ? `#${activeLabel}` : null;

  function expandAddNote(action?: ComposerAction, prefill?: string) {
    // W Skrzynce nie ma kompozytora: „+” ustawia kursor w polu przechwycenia, bez zmiany działu.
    if (view === "inbox") { document.querySelector<HTMLTextAreaElement>("[data-inbox-capture]")?.focus(); return; }
    if (!canCompose) setView("notes");
    // Kompozytor montuje się po zmianie widoku (i pod obciążeniem bywa później niż po 100 ms) — ponawiamy,
    // zamiast po cichu zgubić skrót („+”, „?new=list”, „N”). Najwyżej ok. 3 s.
    const tryExpand = (left: number) => {
      if (addNoteRef.current) { addNoteRef.current.expand(action, prefill); return; }
      if (left > 0) window.setTimeout(() => tryExpand(left - 1), 100);
    };
    window.setTimeout(() => tryExpand(30), 100);
  }

  return { addNoteRef, canCompose, composeDestination, expandAddNote };
}

/**
 * A2.3: akcje na notatkach — pojedyncze, grupowe (zaznaczenie), eksport i trwałe usunięcie. Operacje na danych czyta
 * z `useNotesContext`, więc `Index` podaje tylko to, czego kontekst nie zna: widok, zaznaczenie i listę na ekranie.
 */
export function useNoteScreenActions({ view, groupBy, selection, confirmAction, visibleNotes, notesRef, moveToFolder, deleteVersions }: {
  view: View;
  groupBy: GroupBy;
  selection: Pick<ReturnType<typeof useSelection>, "selectedIds" | "setSelectedIds" | "clearSelection">;
  confirmAction: ReturnType<typeof useConfirmAction>["confirmAction"];
  visibleNotes: Note[];
  notesRef: MutableRefObject<Note[]>;
  moveToFolder: (id: string, folderId: string | null) => void;
  deleteVersions: (ids: string | string[]) => void;
}) {
  const {
    notes, archivedNotes, trashedNotes, folders, propDefs, updateNote, deleteNote, trashNote, restoreFromTrash, togglePin,
    archiveNote, unarchiveNote, addLabel, bulkTrash, bulkArchive, bulkSetColor, bulkRestore,
  } = useNotesContext();
  const { selectedIds, setSelectedIds, clearSelection } = selection;
  const single = useNoteActions({
    notes, archivedNotes, selectedIds, confirmAction, clearSelection,
    trashNote, restoreFromTrash, archiveNote, unarchiveNote,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore, setSelectedIds, displayNotes: visibleNotes,
  });
  const exports = useNoteExport({ notes, archivedNotes, trashedNotes, selectedIds, folders, propDefs });
  const bulk = useBulkNoteOps({
    view, groupBy, folders, notesRef, selectedIds, clearSelection, togglePin, updateNote, addLabel,
    unarchiveNote, bulkRestore, bulkTrash, bulkArchive, moveToFolder,
  });
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = useCallback((id: string) => { deleteNote(id); deleteVersions(id); }, [deleteNote, deleteVersions]);
  const handleDelete = view === "trash" ? deleteNoteForever : single.handleTrashSingle;
  return { ...single, ...exports, ...bulk, deleteNoteForever, handleDelete };
}
