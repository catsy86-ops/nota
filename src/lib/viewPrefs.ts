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
  /** Notatka w panelu „Obok” czytnika (3.7, Ctrl+klik na [[link]]). `null` = brak. Czyta się przez `typeof`, bo zapis może być uszkodzony. */
  readerSplitId: string | null;
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
  readerSplitId: null,
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

/**
 * Ustawienia według sekcji, dla resetu per sekcja (faza 3a). Wygląd ma reset globalny z Wyglądu,
 * więc tu tylko reszta. Każdy klucz jest w dokładnie jednej grupie.
 */
export const VIEW_PREF_GROUPS = {
  edytor: ["defaultNoteColor", "spellcheck", "autosaveSeconds"],
  przypomnienia: ["todayReminderHours", "todayReminderTime", "weekReminderTime", "weekReminderDay"],
  kopia: ["autoExportDays", "backupReminderDays"],
} as const satisfies Record<string, readonly (keyof ViewPrefs)[]>;

/** Nazwy ustawień po polsku — do listy „co się zmieni” w potwierdzeniu resetu. */
export const VIEW_PREF_LABELS: Record<keyof ViewPrefs, string> = {
  density: "gęstość",
  layout: "układ",
  columns: "liczba kolumn",
  autoColumns: "automatyczne kolumny",
  sortKey: "sortowanie",
  sortDir: "kierunek sortowania",
  groupBy: "grupowanie",
  collapsedGroups: "zwinięte grupy",
  filterColor: "filtr koloru",
  filterLabel: "filtr etykiety",
  filterHasReminder: "filtr przypomnień",
  filterPriority: "filtr priorytetu",
  defaultNoteColor: "kolor nowej notatki",
  spellcheck: "sprawdzanie pisowni",
  autosaveSeconds: "autosave",
  autoExportDays: "auto-backup",
  backupReminderDays: "przypomnienie o kopii",
  todayReminderHours: "przypomnienie „Dziś”",
  todayReminderTime: "godzina „Dziś”",
  weekReminderTime: "przypomnienie „Ten tydzień”",
  weekReminderDay: "dzień „Ten tydzień”",
  showReadingTime: "czas czytania",
  showBacklinks: "backlinki",
  readerSplitId: "panel obok w czytniku",
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Ustawienia z podanego zbioru, które różnią się od domyślnych — to, co zmieni się po resecie. */
export function changedViewPrefs(keys: readonly (keyof ViewPrefs)[] = Object.keys(DEFAULTS) as (keyof ViewPrefs)[]): (keyof ViewPrefs)[] {
  const cur = store.get();
  return keys.filter((k) => !sameValue(cur[k], DEFAULTS[k]));
}

/** Przywraca domyślne tylko w podanych kluczach; pozostałe zostają bez zmian. */
export function resetViewPrefKeys(keys: readonly (keyof ViewPrefs)[]) {
  const next: Record<string, unknown> = { ...store.get() };
  for (const k of keys) next[k] = DEFAULTS[k];
  store.set(next as unknown as ViewPrefs);
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
