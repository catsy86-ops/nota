import { useMemo } from "react";
import type { Note, Folder } from "@/hooks/useNotes";
import { getDescendantFolderIds } from "@/hooks/useNotes";
import type { ViewPrefs } from "@/lib/viewPrefs";
import { searchNotes } from "@/lib/searchNotes";
import { getTodayRange, getWeekRange } from "@/lib/dateRanges";
import { PRIORITY_ORDER } from "@/lib/notePriority";

export type View = "notes" | "today" | "week" | "archive" | "label" | "reminders" | "calendar" | "folder" | "widget" | "trash";

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
}

function filterNotes(list: Note[], { view, activeLabel, activeFolder, folders, search }: Pick<FilterArgs, "view" | "activeLabel" | "activeFolder" | "folders" | "search">) {
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
  if (view === "folder" && activeFolder) {
    const descendantIds = getDescendantFolderIds(activeFolder, folders);
    const folderIds = new Set([activeFolder, ...descendantIds]);
    filtered = filtered.filter((n) => n.folderId && folderIds.has(n.folderId));
  }
  if (search) {
    filtered = searchNotes(filtered, search);
  }
  return filtered;
}

function sortNotes(list: Note[], prefs: ViewPrefs): Note[] {
  const dir = prefs.sortDir === "asc" ? 1 : -1;
  function sortFn(a: Note, b: Note) {
    switch (prefs.sortKey) {
      case "title": return a.title.localeCompare(b.title) * dir;
      case "created": return (a.createdAt - b.createdAt) * dir;
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
export function useFilteredNotes({ notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs }: FilterArgs) {
  // Search rebuilds a fresh Fuse index over the filtered pool on every call —
  // fine for hundreds of notes, but worth memoizing so it only reruns when
  // an input actually changes, not on every unrelated re-render (typing
  // elsewhere, a note being edited, etc.).
  return useMemo(() => {
    // Kalendarz rysuje własną projekcję (`expandOccurrences`) i nie korzysta
    // z siatki notatek — nie ma po co filtrować ani budować indeksu Fuse.
    if (view === "calendar") return { displayNotes: [], pinned: [], others: [], elsewhere: NO_ELSEWHERE };

    const baseNotes = view === "archive"
      ? filterNotes(archivedNotes, { view, activeLabel, activeFolder, folders, search })
      : view === "trash"
        ? filterNotes(trashedNotes, { view, activeLabel, activeFolder, folders, search })
        : filterNotes(notes, { view, activeLabel, activeFolder, folders, search });

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
      : sortNotes(filteredByPrefs, prefs);
    const flat = view === "trash" || agenda;
    const pinned = flat ? [] : displayNotes.filter((n) => n.pinned);
    const others = flat ? displayNotes : displayNotes.filter((n) => !n.pinned);

    // Wyszukiwanie przeszukuje pulę bieżącego widoku — ale gdy trafienia są
    // gdzie indziej, mówimy o tym (i dajemy przejście), zamiast udawać, że nic nie ma.
    const elsewhere: Elsewhere = !search ? NO_ELSEWHERE : {
      notes: view === "notes" ? 0 : searchNotes(notes, search).length,
      archive: view === "archive" ? 0 : searchNotes(archivedNotes, search).length,
      trash: view === "trash" ? 0 : searchNotes(trashedNotes, search).length,
    };

    return { displayNotes, pinned, others, elsewhere };
  }, [notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs]);
}
