import type { ChecklistItem } from "@/hooks/useNotes";

const STORAGE_KEY = "kaczy.dayDone.v1";

/** Zadania z notatek w widoku „Dziś”: komplet odhaczony (i jest co odhaczać). */
export function allTodayTasksDone(notes: { checklist?: ChecklistItem[] }[]): boolean {
  let total = 0;
  for (const n of notes) {
    for (const item of n.checklist ?? []) {
      total++;
      if (!item.checked) return false;
    }
  }
  return total > 0;
}

export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nagroda raz na dzień: czy ostatnio nagrodzony dzień jest inny niż dziś. */
export function shouldRewardDay(lastRewardedKey: string | null, todayKey: string): boolean {
  return lastRewardedKey !== todayKey;
}

export function readLastRewardedDay(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markDayRewarded(key = localDayKey()) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    /* ignore quota */
  }
}
