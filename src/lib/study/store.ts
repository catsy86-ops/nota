import { useSyncExternalStore } from "react";
import { isImageRef } from "@/lib/imageStore";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { studyDevice, yStudy } from "./data";
import {
  JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT, SITE_MAX,
  type Column, type JournalEntry, type JournalKind, type StudyState,
} from "./yStudy";

export { COLUMNS, JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT } from "./yStudy";
export type { Column, JournalEntry, JournalKind, StudyState } from "./yStudy";

/**
 * Nauka żyje w dokumencie Yjs notatek (`yStudy.ts`, instancja w `data.ts`),
 * więc synchronizuje się razem z nimi. Ten moduł to fasada dla widoków /nauka:
 * projekcja przefiltrowana przez materiał (`sanitizeStudy`) i akcje.
 */

const isColumn = (v: unknown): v is Column => v === "todo" || v === "doing" || v === "done";

/** Zostawia tylko znane klucze i poprawne wartości — uszkodzony zapis nie psuje widoku. */
export function sanitizeStudy(defaults: StudyState, stored: unknown): StudyState {
  if (!stored || typeof stored !== "object") return defaults;
  const s = stored as Partial<StudyState>;
  const topicIds = new Set(TOPICS.map((t) => t.id));
  const board: Record<string, Column> = {};
  for (const [id, col] of Object.entries(s.board ?? {})) {
    if (topicIds.has(id) && isColumn(col) && col !== "todo") board[id] = col;
  }
  const itemIds = new Set(CHECKLIST.map((c) => c.id));
  const checked: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.checked ?? {})) if (v === true && itemIds.has(id)) checked[id] = true;
  const best = typeof s.bestPercent === "number" && s.bestPercent >= 0 && s.bestPercent <= 100 ? Math.round(s.bestPercent) : null;
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  const questionIds = new Set(QUESTIONS.map((q) => q.id));
  const missed: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.missed ?? {})) if (v === true && questionIds.has(id)) missed[id] = true;
  const journal: JournalEntry[] = [];
  for (const raw of Array.isArray(s.journal) ? s.journal : []) {
    const e = raw as Partial<JournalEntry> | null;
    if (!e || typeof e !== "object") continue;
    if (typeof e.id !== "string" || !e.id || e.id.length > 64) continue;
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) continue;
    const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
    const topic = typeof e.topic === "string" && topicIds.has(e.topic) ? e.topic : null;
    const checkedIds = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && itemIds.has(id)).slice(0, 60) : [];
    const images = Array.isArray(e.images)
      ? e.images.filter((r): r is string => typeof r === "string" && isImageRef(r)).slice(0, JOURNAL_MAX_IMAGES)
      : [];
    if (!text.trim() && checkedIds.length === 0 && images.length === 0) continue;
    journal.push({
      id: e.id, at: e.at, kind: e.kind as JournalKind, topic, text,
      site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
      checked: checkedIds,
      images,
    });
  }
  journal.sort((a, b) => a.at - b.at);
  const site = typeof s.site === "string" ? s.site.slice(0, SITE_MAX) : "";
  const lastDay = typeof s.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.lastDay) ? s.lastDay : null;
  const streak = lastDay && typeof s.streak === "number" && s.streak >= 1 ? Math.floor(s.streak) : 0;
  return { board, checked, bestPercent: best, rounds, missed, journal, site, streak, lastDay };
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "", streak: 0, lastDay: null };

let lastRaw: StudyState | null = null;
let lastClean: StudyState = DEFAULTS;

/** Projekcja dokumentu przefiltrowana przez materiał; ta sama referencja, dopóki dokument się nie zmieni. */
export function getStudy(): StudyState {
  const raw = yStudy.get();
  if (raw !== lastRaw) { lastRaw = raw; lastClean = sanitizeStudy(DEFAULTS, raw); }
  return lastClean;
}

export const useStudy = () => useSyncExternalStore(yStudy.subscribe, getStudy);

/** Seria, która jeszcze trwa: ostatnia runda dziś albo wczoraj; starsza już przepadła. */
export function activeStreak(state: Pick<StudyState, "streak" | "lastDay">, today = localDayKey()): number {
  if (!state.lastDay) return 0;
  return state.lastDay === today || state.lastDay === addDaysToKey(today, -1) ? state.streak : 0;
}

export function columnOf(state: StudyState, topicId: string): Column {
  return state.board[topicId] ?? "todo";
}

export function moveTopic(topicId: string, column: Column) {
  yStudy.setColumn(topicId, column);
}

export function toggleChecked(itemId: string) {
  yStudy.setChecked(itemId, !getStudy().checked[itemId]);
}

export function resetChecklist() {
  yStudy.clearChecked();
}

/**
 * Zapisuje wynik rundy; tematy z błędami wracają z „Umiem” do „W trakcie”.
 * `results` aktualizuje listę błędnych pytań: dobra odpowiedź ją czyści, zła dopisuje.
 */
export function recordRound(
  correct: number,
  total: number,
  missed: string[],
  results: { id: string; ok: boolean }[] = [],
  today = localDayKey(),
): { demoted: string[]; streak: number; streakGrew: boolean } {
  const s = getStudy();
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const demoted = [...new Set(missed)].filter((id) => s.board[id] === "done");
  const streakGrew = s.lastDay !== today;
  yStudy.recordRound(studyDevice(), percent, today, demoted, results);
  return { demoted, streak: activeStreak(getStudy(), today), streakGrew };
}

export interface NewJournalEntry {
  kind: JournalKind;
  topic: string | null;
  text: string;
  checked?: string[];
  images?: string[];
}

/**
 * Dopisuje wpis z budowy. Problem przy temacie z kolumny „Umiem” cofa go do „W trakcie” —
 * teoria nie wytrzymała praktyki, więc wraca do powtórki (i na początek quizu).
 */
export function addJournalEntry(input: NewJournalEntry, now: number = Date.now()): JournalEntry | null {
  const text = input.text.trim().slice(0, JOURNAL_MAX_TEXT);
  const checked = (input.checked ?? []).filter((id) => CHECKLIST.some((c) => c.id === id));
  const images = (input.images ?? []).filter(isImageRef).slice(0, JOURNAL_MAX_IMAGES);
  if (!text && checked.length === 0 && images.length === 0) return null;
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: now,
    kind: input.kind,
    topic: input.topic && TOPICS.some((t) => t.id === input.topic) ? input.topic : null,
    text,
    site: getStudy().site,
    checked,
    images,
  };
  yStudy.addEntry(entry);
  return entry;
}

/** Przywraca usunięty wpis (Cofnij) na właściwe miejsce w czasie. */
export function restoreJournalEntry(entry: JournalEntry) {
  yStudy.restoreEntry(entry);
}

export function removeJournalEntry(id: string): JournalEntry | null {
  return yStudy.removeEntry(id);
}

export function setSite(site: string) {
  yStudy.setSite(site.slice(0, SITE_MAX));
}

export interface TopicPractice {
  ok: number;
  problem: number;
  /** Moment ostatniego wpisu o temacie. */
  last: number;
}

/** Ile razy temat pojawił się na budowie i ile razy sprawił problem. */
export function practiceByTopic(journal: readonly JournalEntry[]): Map<string, TopicPractice> {
  const out = new Map<string, TopicPractice>();
  for (const e of journal) {
    if (!e.topic) continue;
    const p = out.get(e.topic) ?? { ok: 0, problem: 0, last: 0 };
    if (e.kind === "ok") p.ok += 1;
    else if (e.kind === "problem") p.problem += 1;
    p.last = Math.max(p.last, e.at);
    out.set(e.topic, p);
  }
  return out;
}
