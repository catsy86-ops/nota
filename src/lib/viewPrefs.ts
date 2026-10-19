import type { NoteColor } from "@/hooks/useNotes";
import type { NotePriority } from "@/lib/notePriority";
import { createPersistedStore } from "@/lib/persistedStore";
import type { GroupBy } from "@/lib/groupNotes";

export type Density = "compact" | "cozy" | "comfy";
export type Layout = "masonry" | "grid" | "list" | "board" | "table";
/** `prop:<id>` = sortowanie po własnym polu notatki (id z `propDefs`). */
export type SortKey = "updated" | "created" | "opened" | "title" | "color" | "priority" | "manual" | `prop:${string}`;
export type SortDir = "desc" | "asc";

export interface ViewPrefs {
  density: Density;
  layout: Layout;
  columns: number; // 1-4 (auto if 0)
  autoColumns: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  /** Podział widoku na sekcje (nagłówki w stylu zeszytu). */
  groupBy: GroupBy;
  /** Zwinięte sekcje: `pinned` albo `<groupBy>:<klucz grupy>`. */
  collapsedGroups: string[];
  filterColor: NoteColor | "all";
  filterLabel: string | "all";
  filterHasReminder: boolean;
  filterPriority: NotePriority | "all";
  defaultNoteColor: NoteColor;
  spellcheck: boolean;
  autosaveSeconds: number;
  autoExportDays: number; // 0 = off
  backupReminderDays: number; // 0 = off
  todayReminderHours: number; // 0 = off, otherwise interval in hours between nudges
  todayReminderTime: string; // "" = disabled, otherwise "HH:mm" for daily fixed-time reminder (takes priority over interval)
  weekReminderTime: string; // "" = disabled, otherwise "HH:mm" for weekly fixed-time reminder
  weekReminderDay: number; // 0 = Sunday … 6 = Saturday (default 0 = niedziela, jak przegląd tygodnia)
  showReadingTime: boolean;
  showBacklinks: boolean;
}

const DEFAULTS: ViewPrefs = {
  density: "cozy",
  layout: "masonry",
  columns: 0,
  autoColumns: true,
  sortKey: "updated",
  sortDir: "desc",
  groupBy: "none",
  collapsedGroups: [],
  filterColor: "all",
  filterLabel: "all",
  filterHasReminder: false,
  filterPriority: "all",
  defaultNoteColor: "default",
  spellcheck: true,
  autosaveSeconds: 0,
  autoExportDays: 7,
  backupReminderDays: 14,
  todayReminderHours: 0,
  todayReminderTime: "",
  weekReminderTime: "",
  weekReminderDay: 0,
  showReadingTime: true,
  showBacklinks: true,
};

const store = createPersistedStore<ViewPrefs>("kaczy.viewPrefs.v1", DEFAULTS, {
  // Uszkodzony zapis (np. tekst zamiast obiektu) nie może rozsypać się w klucze „0”, „1”… — wtedy domyślne.
  merge: (defaults, stored) =>
    stored !== null && typeof stored === "object" && !Array.isArray(stored) ? { ...defaults, ...stored } : defaults,
});

export function getViewPrefs(): ViewPrefs {
  return store.get();
}

export function setViewPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) {
  store.set({ ...store.get(), [key]: value });
}

/** Zwija / rozwija sekcję; stan trzymany w prefsach, więc przeżywa przeładowanie. */
export function toggleGroupCollapsed(key: string) {
  const cur = store.get().collapsedGroups;
  setViewPref("collapsedGroups", cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
}

export function resetViewPrefs() {
  store.set({ ...DEFAULTS });
}

export function useViewPrefs(): ViewPrefs {
  return store.use();
}

// --- helpers ---

export const READ_WPM = 220;
export function readingTimeMin(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / READ_WPM));
}
