import { useEffect, useMemo } from "react";
import type { Note, Folder } from "@/hooks/useNotes";
import { getDescendantFolderIds } from "@/hooks/useNotes";
import type { ViewPrefs } from "@/lib/viewPrefs";
import { searchNotes, useSearchReady, loadSearchIndex } from "@/lib/searchNotes";
import { getTodayRange, getWeekRange } from "@/lib/dateRanges";
import { PRIORITY_ORDER } from "@/lib/notePriority";
import { useLastOpened, type LastOpenedMap } from "@/lib/lastOpened";
import { useDayClock } from "@/lib/dayClock";
import { comparePropsForSort, type PropDef } from "@/lib/noteProps";
import { isInboxNote } from "@/lib/inbox";

const NO_OPENED: LastOpenedMap = {};

export type View = "notes" | "today" | "week" | "archive" | "label" | "reminders" | "calendar" | "shifts" | "study" | "folder" | "widget" | "trash" | "inbox";

/** Liczba trafień wyszukiwania poza bieżącym widokiem. */
export interface Elsewhere { notes: number; archive: number; trash: number }
const NO_ELSEWHERE: Elsewhere = { notes: 0, archive: 0, trash: 0 };

interface FilterArgs {
  notes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  folders: Folder[];
  view: View;
  activeLabel: string | null;
  activeFolder: string | null;
  search: string;
  prefs: ViewPrefs;
  propDefs?: PropDef[];
}

function filterNotes(list: Note[], source: Note[], { view, activeLabel, activeFolder, folders, search, propDefs }: Pick<FilterArgs, "view" | "activeLabel" | "activeFolder" | "folders" | "search" | "propDefs">) {
  let filtered = list;
  if (activeLabel && view === "label") {
    filtered = filtered.filter((n) => n.labels.includes(activeLabel));
  }
  if (view === "reminders") {
    filtered = filtered.filter((n) => n.reminder !== null);
  }
  if (view === "today") {
    const { start, end } = getTodayRange();
    filtered = filtered.filter((n) => (n.createdAt >= start && n.createdAt <= end) || (n.updatedAt >= start && n.updatedAt <= end));
  }
  if (view === "week") {
    const { start, end } = getWeekRange();
    filtered = filtered.filter((n) => (n.createdAt >= start && n.createdAt <= end) || (n.updatedAt >= start && n.updatedAt <= end));
  }
  if (view === "inbox") {
    filtered = filtered.filter(isInboxNote);
  }
  if (view === "folder" && activeFolder) {
    const descendantIds = getDescendantFolderIds(activeFolder, folders);
    const folderIds = new Set([activeFolder, ...descendantIds]);
    filtered = filtered.filter((n) => n.folderId && folderIds.has(n.folderId));
  }
  if (search) {
    filtered = searchNotes(filtered, search, { folders, propDefs }, source);
  }
  return filtered;
}

function sortNotes(list: Note[], prefs: ViewPrefs, opened: LastOpenedMap, propDefs: PropDef[]): Note[] {
  const dir = prefs.sortDir === "asc" ? 1 : -1;
  if (prefs.sortKey.startsWith("prop:")) {
    // Brak pola (usunięte po wybraniu sortowania) = zwykłe sortowanie po dacie zmiany.
    const def = propDefs.find((d) => `prop:${d.id}` === prefs.sortKey);
    if (def) return [...list].sort((a, b) => comparePropsForSort(def, a.props, b.props, dir) || b.updatedAt - a.updatedAt);
  }
  function sortFn(a: Note, b: Note) {
    switch (prefs.sortKey) {
      case "title": return a.title.localeCompare(b.title) * dir;
      case "created": return (a.createdAt - b.createdAt) * dir;
      // Nigdy nie otwierane (0) lądują na końcu przy malejącym; remis rozstrzyga data modyfikacji.
      case "opened": return ((opened[a.id] ?? 0) - (opened[b.id] ?? 0) || a.updatedAt - b.updatedAt) * dir;
      case "color": return a.color.localeCompare(b.color) * dir;
      case "priority": return (PRIORITY_ORDER[a.priority ?? "none"] - PRIORITY_ORDER[b.priority ?? "none"]) * dir;
      case "manual": return (a.order ?? 0) - (b.order ?? 0); // direction doesn't apply to hand-dragged order
      case "updated":
      default: return (a.updatedAt - b.updatedAt) * dir;
    }
  }
  return [...list].sort(sortFn);
}

/** Pure filter/sort pipeline: view + label/folder + prefs + search + sort, split into pinned/others. */
export function useFilteredNotes({ notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs, propDefs = [] }: FilterArgs) {
  // Search rebuilds a fresh Fuse index over the filtered pool on every call —
  // fine for hundreds of notes, but worth memoizing so it only reruns when
  // an input actually changes, not on every unrelated re-render (typing
  // elsewhere, a note being edited, etc.).
  // Mapa „ostatnio otwierane” zmienia się przy każdym otwarciu notatki — nasłuchujemy jej tylko przy tym sortowaniu.
  const lastOpened = useLastOpened();
  const opened = prefs.sortKey === "opened" ? lastOpened : NO_OPENED;
  // Granice „Dziś” i „Ten tydzień” liczy filtr — po północy i po powrocie do karty
  // muszą się przeliczyć mimo niezmienionych notatek.
  const dayTick = useDayClock();
  // Fuse poza główną paczką: wczytujemy w wolnej chwili, a po dojściu wyniki się przeliczają.
  const searchReady = useSearchReady();
  useEffect(() => {
    if (searchReady) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (!w.requestIdleCallback) { const t = window.setTimeout(() => void loadSearchIndex(), 1500); return () => window.clearTimeout(t); }
    const id = w.requestIdleCallback(() => void loadSearchIndex(), { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }, [searchReady]);
  return useMemo(() => {
    // Kalendarz rysuje własną projekcję (`expandOccurrences`) i nie korzysta
    // z siatki notatek — nie ma po co filtrować ani budować indeksu Fuse.
    if (view === "calendar" || view === "shifts" || view === "study") return { displayNotes: [], pinned: [], others: [], elsewhere: NO_ELSEWHERE };

    const baseNotes = view === "archive"
      ? filterNotes(archivedNotes, archivedNotes, { view, activeLabel, activeFolder, folders, search, propDefs })
      : view === "trash"
        ? filterNotes(trashedNotes, trashedNotes, { view, activeLabel, activeFolder, folders, search, propDefs })
        : filterNotes(notes, notes, { view, activeLabel, activeFolder, folders, search, propDefs });

    const filteredByPrefs = view === "trash" ? baseNotes : baseNotes.filter((n) => {
      if (prefs.filterColor !== "all" && n.color !== prefs.filterColor) return false;
      if (prefs.filterLabel !== "all" && !n.labels.includes(prefs.filterLabel)) return false;
      if (prefs.filterHasReminder && !n.reminder) return false;
      if (prefs.filterPriority !== "all" && (n.priority ?? "none") !== prefs.filterPriority) return false;
      return true;
    });

    // Przypomnienia to agenda: po terminie, bez podziału na przypięte
    // (grupy Zaległe/Dziś/… układa `groupReminders` w widoku).
    const agenda = view === "reminders";
    const displayNotes = agenda
      ? [...filteredByPrefs].sort((a, b) => (a.reminder ?? 0) - (b.reminder ?? 0))
      : sortNotes(filteredByPrefs, prefs, opened, propDefs);
    // Archiwum też bez „Przypiętych”: archiwizacja odpina, ale stara kopia/import może mieć oba pola —
    // bez tego taka notatka znikałaby z widoku (sekcji przypiętych archiwum nie pokazuje).
    const flat = view === "trash" || view === "archive" || agenda;
    const pinned = flat ? [] : displayNotes.filter((n) => n.pinned);
    const others = flat ? displayNotes : displayNotes.filter((n) => !n.pinned);

    // Wyszukiwanie przeszukuje pulę bieżącego widoku — ale gdy trafienia są
    // gdzie indziej, mówimy o tym (i dajemy przejście), zamiast udawać, że nic nie ma.
    // Liczymy tylko przy pustym wyniku — tylko wtedy EmptyState pokazuje przejścia, a trzy
    // dodatkowe wyszukiwania przy każdej edycji notatki były kosztem bez odbiorcy.
    const elsewhere: Elsewhere = !search || displayNotes.length > 0 ? NO_ELSEWHERE : {
      notes: view === "notes" ? 0 : searchNotes(notes, search, { folders }).length,
      archive: view === "archive" ? 0 : searchNotes(archivedNotes, search, { folders }).length,
      trash: view === "trash" ? 0 : searchNotes(trashedNotes, search, { folders }).length,
    };

    return { displayNotes, pinned, others, elsewhere };
    // `dayTick` i `searchReady` nie są czytane w środku — wymuszają przeliczenie granic „Dziś” i wyników po wczytaniu Fuse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs, opened, dayTick, searchReady]);
}
