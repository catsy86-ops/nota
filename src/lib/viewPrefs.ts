import type { NoteColor } from "@/hooks/useNotes";
import type { NotePriority } from "@/lib/notePriority";
import { createPersistedStore } from "@/lib/persistedStore";

export type Density = "compact" | "cozy" | "comfy";
export type Layout = "masonry" | "grid" | "list";
export type SortKey = "updated" | "created" | "title" | "color" | "priority" | "manual";
export type SortDir = "desc" | "asc";

export interface ViewPrefs {
  density: Density;
  layout: Layout;
  columns: number; // 1-4 (auto if 0)
  autoColumns: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
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
  weekReminderDay: number; // 0 = Sunday … 6 = Saturday (default 1 = Monday)
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
  filterColor: "all",
  filterLabel: "all",
  filterHasReminder: false,
  filterPriority: "all",
  defaultNoteColor: "default",
  spellcheck: true,
  autosaveSeconds: 0,
  autoExportDays: 7,
  backupReminderDays: 14,
  todayReminderHours: 6,
  todayReminderTime: "",
  weekReminderTime: "",
  weekReminderDay: 1,
  showReadingTime: true,
  showBacklinks: true,
};

const store = createPersistedStore<ViewPrefs>("kaczy.viewPrefs.v1", DEFAULTS, {
  merge: (defaults, stored) => ({ ...defaults, ...stored }),
});

export function getViewPrefs(): ViewPrefs {
  return store.get();
}

export function setViewPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) {
  store.set({ ...store.get(), [key]: value });
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
