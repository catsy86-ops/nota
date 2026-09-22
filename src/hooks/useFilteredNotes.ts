import type { Note, Folder } from "@/hooks/useNotes";
import { getDescendantFolderIds } from "@/hooks/useNotes";
import type { ViewPrefs } from "@/lib/viewPrefs";
import { searchNotes } from "@/lib/searchNotes";
import { getTodayRange, getWeekRange } from "@/lib/dateRanges";

export type View = "notes" | "today" | "week" | "archive" | "label" | "reminders" | "folder" | "widget" | "trash";

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
      case "updated":
      default: return (a.updatedAt - b.updatedAt) * dir;
    }
  }
  return [...list].sort(sortFn);
}

/** Pure filter/sort pipeline: view + label/folder + prefs + search + sort, split into pinned/others. */
export function useFilteredNotes({ notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs }: FilterArgs) {
  const baseNotes = view === "archive"
    ? filterNotes(archivedNotes, { view, activeLabel, activeFolder, folders, search })
    : view === "trash"
      ? trashedNotes
      : filterNotes(notes, { view, activeLabel, activeFolder, folders, search });

  const filteredByPrefs = view === "trash" ? baseNotes : baseNotes.filter((n) => {
    if (prefs.filterColor !== "all" && n.color !== prefs.filterColor) return false;
    if (prefs.filterLabel !== "all" && !n.labels.includes(prefs.filterLabel)) return false;
    if (prefs.filterHasReminder && !n.reminder) return false;
    return true;
  });

  const displayNotes = sortNotes(filteredByPrefs, prefs);
  const pinned = view === "trash" ? [] : displayNotes.filter((n) => n.pinned);
  const others = view === "trash" ? displayNotes : displayNotes.filter((n) => !n.pinned);

  return { displayNotes, pinned, others };
}
