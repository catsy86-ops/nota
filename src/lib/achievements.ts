import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Note } from "@/hooks/useNotes";

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Returns 0..1 progress for the achievement. */
  progress: (stats: AchievementStats) => number;
}

export interface AchievementStats {
  totalNotes: number;
  pinnedNotes: number;
  archivedNotes: number;
  totalLabels: number;
  totalFolders: number;
  checklistsCompleted: number;
  totalChecklistItems: number;
  oldestNoteAgeDays: number;
  currentStreak: number;
  longestStreak: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-note", emoji: "🐣", title: "Pierwszy krok", description: "Stwórz pierwszą notatkę", progress: (s) => Math.min(1, s.totalNotes / 1) },
  { id: "ten-notes", emoji: "📚", title: "Mała biblioteka", description: "10 notatek w kolekcji", progress: (s) => Math.min(1, s.totalNotes / 10) },
  { id: "fifty-notes", emoji: "🏛️", title: "Architekt myśli", description: "50 notatek razem", progress: (s) => Math.min(1, s.totalNotes / 50) },
  { id: "pin-master", emoji: "📌", title: "Mistrz pinezki", description: "Przypnij 5 notatek", progress: (s) => Math.min(1, s.pinnedNotes / 5) },
  { id: "labeler", emoji: "🏷️", title: "Porządkowicz", description: "Stwórz 5 etykiet", progress: (s) => Math.min(1, s.totalLabels / 5) },
  { id: "folder-fan", emoji: "📁", title: "Fan folderów", description: "Stwórz 3 foldery", progress: (s) => Math.min(1, s.totalFolders / 3) },
  { id: "checklist-hero", emoji: "✅", title: "Bohater list", description: "Ukończ 10 checklist", progress: (s) => Math.min(1, s.checklistsCompleted / 10) },
  { id: "veteran", emoji: "🦆", title: "Weteran KACZY", description: "Korzystaj 30 dni", progress: (s) => Math.min(1, s.oldestNoteAgeDays / 30) },
  { id: "week-streak", emoji: "🔥", title: "Tydzień w ogniu", description: "7 dni z rzędu aktywności", progress: (s) => Math.min(1, s.longestStreak / 7) },
];

export function computeStats(notes: Note[], archivedNotes: Note[], allLabels: string[], folders: { id: string }[]): AchievementStats {
  const all = [...notes, ...archivedNotes];
  const checklistsCompleted = all.filter((n) => (n.checklist?.length ?? 0) > 0 && n.checklist!.every((i) => i.checked)).length;
  const totalChecklistItems = all.reduce((sum, n) => sum + (n.checklist?.length ?? 0), 0);
  const oldest = all.length > 0 ? all.reduce((min, n) => Math.min(min, n.createdAt), Date.now()) : Date.now();
  const oldestNoteAgeDays = (Date.now() - oldest) / (1000 * 60 * 60 * 24);
  const dailyCounts = computeDailyActivityCounts(notes, archivedNotes);
  const { current, longest } = computeStreak(new Set(dailyCounts.keys()));
  return {
    totalNotes: all.length,
    pinnedNotes: notes.filter((n) => n.pinned).length,
    archivedNotes: archivedNotes.length,
    totalLabels: allLabels.length,
    totalFolders: folders.length,
    checklistsCompleted,
    totalChecklistItems,
    oldestNoteAgeDays,
    currentStreak: current,
    longestStreak: longest,
  };
}

// ------------------ Activity streaks ------------------

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Parses a `dayKey` string back into a local-midnight Date (avoids UTC-parsing off-by-one). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Per-day count of notes created or edited (deduped so a same-day create+edit counts once). */
export function computeDailyActivityCounts(notes: Note[], archivedNotes: Note[]): Map<string, number> {
  const all = [...notes, ...archivedNotes];
  const counts = new Map<string, number>();
  for (const n of all) {
    const days = new Set([dayKey(n.createdAt), dayKey(n.updatedAt)]);
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return counts;
}

export interface ActivityStreak {
  current: number;
  longest: number;
}

/** Current streak counts back from today (or yesterday, if today has no activity yet). */
export function computeStreak(activeDays: Set<string>): ActivityStreak {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cursor = new Date(today);
  if (!activeDays.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (activeDays.has(dayKey(cursor.getTime()))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const sorted = Array.from(activeDays).sort();
  let longest = 0;
  let run = 0;
  let prevDay: Date | null = null;
  for (const key of sorted) {
    const date = parseDayKey(key);
    if (prevDay) {
      const expected = new Date(prevDay);
      expected.setDate(expected.getDate() + 1);
      run = expected.getTime() === date.getTime() ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prevDay = date;
  }

  return { current, longest: Math.max(longest, current) };
}

/** Daily activity counts for the last `days` days (oldest first), for a chart. */
export function activityLastNDays(counts: Map<string, number>, days: number): { date: string; count: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return result;
}

// ------------------ Persistence ------------------

const STORAGE_KEY = "kaczy.achievements.v1";

interface PersistedState {
  /** Ratcheted max-ever values per stat key. */
  maxStats: Partial<AchievementStats>;
  /** Map of achievement id → unlock timestamp (ms). */
  unlockedAt: Record<string, number>;
}

const EMPTY: PersistedState = { maxStats: {}, unlockedAt: {} };

function read(): PersistedState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return { maxStats: parsed.maxStats ?? {}, unlockedAt: parsed.unlockedAt ?? {} };
  } catch {
    return EMPTY;
  }
}

let state: PersistedState = read();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getPersistedAchievements(): PersistedState {
  return state;
}

/** Reset all persisted achievement progress (used by Settings). */
export function resetAchievements() {
  state = { maxStats: {}, unlockedAt: {} };
  persist();
}

/**
 * Merge live stats with the persisted ratchet so badges never regress.
 * Returns the effective stats and unlocked map without mutating storage.
 */
export function mergeWithPersisted(stats: AchievementStats): { effective: AchievementStats; unlockedAt: Record<string, number> } {
  const merged: AchievementStats = { ...stats };
  const max = state.maxStats;
  (Object.keys(stats) as (keyof AchievementStats)[]).forEach((k) => {
    const prev = (max[k] as number | undefined) ?? 0;
    merged[k] = Math.max(prev, stats[k]) as never;
  });
  return { effective: merged, unlockedAt: state.unlockedAt };
}

/**
 * Record latest stats: ratchets max values, captures new unlock timestamps,
 * and returns any newly unlocked achievements (for toast notifications).
 */
export function recordStats(stats: AchievementStats): {
  effective: AchievementStats;
  unlockedAt: Record<string, number>;
  newlyUnlocked: Achievement[];
} {
  const next: PersistedState = {
    maxStats: { ...state.maxStats },
    unlockedAt: { ...state.unlockedAt },
  };
  const merged: AchievementStats = { ...stats };
  (Object.keys(stats) as (keyof AchievementStats)[]).forEach((k) => {
    const prev = (next.maxStats[k] as number | undefined) ?? 0;
    const v = Math.max(prev, stats[k]);
    merged[k] = v as never;
    next.maxStats[k] = v as never;
  });
  const newly: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (a.progress(merged) >= 1 && !next.unlockedAt[a.id]) {
      next.unlockedAt[a.id] = Date.now();
      newly.push(a);
    }
  }
  state = next;
  persist();
  return { effective: merged, unlockedAt: next.unlockedAt, newlyUnlocked: newly };
}

/** Subscribe to persisted achievement changes (for reactive UI). */
export function usePersistedAchievements(): PersistedState {
  return useSyncExternalStore(subscribe, getPersistedAchievements, getPersistedAchievements);
}

/**
 * Hook that watches live stats, persists ratcheted progress, and fires
 * a callback for newly unlocked achievements (great for toast popups).
 */
export function useAchievementTracker(
  notes: Note[],
  archivedNotes: Note[],
  allLabels: string[],
  folders: { id: string }[],
  onUnlock?: (a: Achievement) => void
): { stats: AchievementStats; unlockedAt: Record<string, number> } {
  const liveStats = computeStats(notes, archivedNotes, allLabels, folders);
  // Exclude time-derived field (oldestNoteAgeDays) from the dep key —
  // it changes every render and would cause an infinite update loop.
  const { oldestNoteAgeDays: _omit, ...stableStats } = liveStats;
  const statsKey = JSON.stringify(stableStats);
  // Don't fire unlocks on the very first render (avoids spamming on page load).
  const initialized = useRef(false);
  const onUnlockRef = useRef(onUnlock);
  useEffect(() => { onUnlockRef.current = onUnlock; }, [onUnlock]);
  const persisted = usePersistedAchievements();
  const liveStatsRef = useRef(liveStats);
  liveStatsRef.current = liveStats;

  useEffect(() => {
    const { newlyUnlocked } = recordStats(liveStatsRef.current);
    if (initialized.current) {
      newlyUnlocked.forEach((a) => onUnlockRef.current?.(a));
    }
    initialized.current = true;
  }, [statsKey]);

  const { effective } = mergeWithPersisted(liveStats);
  return { stats: effective, unlockedAt: persisted.unlockedAt };
}
