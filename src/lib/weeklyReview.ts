import type { Note } from "@/hooks/useNotes";
import { createPersistedStore } from "@/lib/persistedStore";
import { localDayKey } from "@/lib/dayDone";
import { termStatus } from "@/lib/dueTerms";

/**
 * Cotygodniowy przegląd notatek: czysta logika (co pokazać i kiedy).
 * Nic tu nie zmienia notatek — akcje robi karta przez istniejące callbacki.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const STALE_DAYS = 30;
export const OPEN_LIST_DAYS = 7;
export const MAX_EXAMPLES = 5;

export type ReviewCategoryKey = "stale" | "openLists" | "overdue" | "unsorted";

export interface ReviewCategory {
  key: ReviewCategoryKey;
  label: string;
  hint: string;
  count: number;
  /** Do 5 pierwszych pozycji (najpilniejsze na górze). */
  examples: Note[];
  /** Wszystkie pozycje kategorii — dla trybu „po kolei”. */
  notes: Note[];
}

export interface WeeklyReview {
  categories: ReviewCategory[];
  /** Liczba różnych notatek (jedna może trafić do kilku kategorii). */
  total: number;
}

const META: Record<ReviewCategoryKey, { label: string; hint: string }> = {
  overdue: { label: "Zaległe przypomnienia", hint: "Termin minął, a przypomnienie nadal czeka" },
  openLists: { label: "Listy do dokończenia", hint: "Nieodhaczone pozycje, bez ruchu od tygodnia" },
  stale: { label: "Nietknięte od miesiąca", hint: "Ostatnia zmiana ponad 30 dni temu" },
  unsorted: { label: "Do posegregowania", hint: "Bez folderu i bez etykiet" },
};

const ORDER: ReviewCategoryKey[] = ["overdue", "openLists", "stale", "unsorted"];

function isLive(n: Note): boolean {
  // Notatki prywatne nie trafiają do przeglądu (nie ma tu czego pokazać bez ujawniania treści).
  return !n.archived && !n.trashed && !n.locked;
}

function hasText(n: Note): boolean {
  return Boolean(n.title.trim() || n.content.trim() || n.checklist?.length || n.images?.length);
}

export function buildWeeklyReview(notes: Note[], now: number = Date.now()): WeeklyReview {
  const live = notes.filter(isLive);
  const lists: Record<ReviewCategoryKey, Note[]> = { overdue: [], openLists: [], stale: [], unsorted: [] };

  for (const n of live) {
    if (n.reminder !== null && termStatus(n.reminder, now, n.reminderAllDay === true) === "overdue") lists.overdue.push(n);
    if ((n.checklist ?? []).some((i) => !i.checked) && n.updatedAt <= now - OPEN_LIST_DAYS * DAY_MS) lists.openLists.push(n);
    // Notatka dnia to dziennik, nie zaległość do sprzątania.
    if (n.dailyDate) continue;
    if (!n.pinned && n.updatedAt <= now - STALE_DAYS * DAY_MS) lists.stale.push(n);
    if (n.folderId === null && n.labels.length === 0 && hasText(n)) lists.unsorted.push(n);
  }

  lists.overdue.sort((a, b) => (a.reminder as number) - (b.reminder as number));
  for (const k of ["openLists", "stale", "unsorted"] as const) lists[k].sort((a, b) => a.updatedAt - b.updatedAt);

  const categories: ReviewCategory[] = ORDER.filter((k) => lists[k].length > 0).map((k) => ({
    key: k,
    ...META[k],
    count: lists[k].length,
    examples: lists[k].slice(0, MAX_EXAMPLES),
    notes: lists[k],
  }));
  const ids = new Set<string>();
  for (const c of categories) for (const n of c.notes) ids.add(n.id);
  return { categories, total: ids.size };
}

/** Kolejka trybu „po kolei”: każda notatka raz, z kategorią, w której pojawiła się pierwsza. */
export function reviewQueue(review: WeeklyReview): { note: Note; category: ReviewCategoryKey }[] {
  const seen = new Set<string>();
  const out: { note: Note; category: ReviewCategoryKey }[] = [];
  for (const c of review.categories) {
    for (const note of c.notes) {
      if (seen.has(note.id)) continue;
      seen.add(note.id);
      out.push({ note, category: c.key });
    }
  }
  return out;
}

// ---------- Kiedy pokazać kartę ----------

/** Początek okna: wieczór dnia przeglądu. Koniec: następny dzień do południa. */
export const REVIEW_START_HOUR = 17;
export const REVIEW_END_HOUR = 12;

export const REVIEW_DAY_NAMES = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"] as const;

/**
 * Klucz bieżącego cyklu (data dnia przeglądu), jeśli `now` mieści się w oknie
 * „dzień przeglądu od 17:00 → następny dzień do 12:00”; inaczej `null`.
 * `day`: 0 = niedziela … 6 = sobota (jak `Date#getDay`).
 */
export function reviewCycleKey(now: number, day: number): string | null {
  for (const back of [0, 1]) {
    const c = new Date(now);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - back);
    if (c.getDay() !== day) continue;
    const start = new Date(c);
    start.setHours(REVIEW_START_HOUR, 0, 0, 0);
    const end = new Date(c);
    end.setDate(end.getDate() + 1);
    end.setHours(REVIEW_END_HOUR, 0, 0, 0);
    if (now >= start.getTime() && now < end.getTime()) return localDayKey(c);
  }
  return null;
}

export interface ReviewState {
  /** `null` = przegląd wyłączony. */
  day: number | null;
  snoozeUntil: number;
  closedKey: string | null;
}

export function dueCycleKey(now: number, state: ReviewState): string | null {
  if (state.day === null) return null;
  const key = reviewCycleKey(now, state.day);
  if (!key || state.closedKey === key || now < state.snoozeUntil) return null;
  return key;
}

/** „Przypomnij jutro”: od północy następnego dnia (poniedziałkowy poranek nadal mieści się w oknie). */
export function snoozeUntilTomorrow(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

// ---------- Ustawienia (localStorage `kaczy:review.*`) ----------

const dayStore = createPersistedStore<number | "off">("kaczy:review.day", 0, {
  merge: (defaults, stored) => {
    if (stored === "off") return "off";
    return typeof stored === "number" && Number.isInteger(stored) && stored >= 0 && stored <= 6 ? stored : defaults;
  },
});
const snoozeStore = createPersistedStore<number>("kaczy:review.snoozeUntil", 0, {
  merge: (d, s) => (typeof s === "number" && Number.isFinite(s) ? s : d),
});
const closedStore = createPersistedStore<string | null>("kaczy:review.closed", null, {
  merge: (d, s) => (typeof s === "string" ? s : d),
});

export function useReviewDay(): number | null {
  const v = dayStore.use();
  return v === "off" ? null : v;
}
export function setReviewDay(day: number | null) {
  dayStore.set(day === null ? "off" : day);
}
export function useReviewState(): ReviewState {
  const day = useReviewDay();
  const snoozeUntil = snoozeStore.use();
  const closedKey = closedStore.use();
  return { day, snoozeUntil, closedKey };
}
export function snoozeReview(now: number = Date.now()) {
  snoozeStore.set(snoozeUntilTomorrow(now));
}
export function closeReviewCycle(key: string) {
  closedStore.set(key);
}
