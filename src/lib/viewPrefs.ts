import { useSyncExternalStore } from "react";
import type { NoteColor } from "@/hooks/useNotes";
import type { NotePriority } from "@/lib/notePriority";

export type Density = "compact" | "cozy" | "comfy";
export type Layout = "masonry" | "grid" | "list";
export type SortKey = "updated" | "created" | "title" | "color" | "priority";
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

const KEY = "kaczy.viewPrefs.v1";

function read(): ViewPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

let state: ViewPrefs = read();
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function getViewPrefs(): ViewPrefs {
  return state;
}

export function setViewPref<K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) {
  state = { ...state, [key]: value };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  emit();
}

export function resetViewPrefs() {
  state = { ...DEFAULTS };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useViewPrefs(): ViewPrefs {
  return useSyncExternalStore(subscribe, getViewPrefs, getViewPrefs);
}

// --- helpers ---

export const READ_WPM = 220;
export function readingTimeMin(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / READ_WPM));
}
