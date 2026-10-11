import { createPersistedStore } from "@/lib/persistedStore";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";

export type Column = "todo" | "doing" | "done";
export const COLUMNS: Column[] = ["todo", "doing", "done"];

/** Rodzaj wpisu w dzienniku z budowy. */
export type JournalKind = "ok" | "problem" | "note";
export const JOURNAL_KINDS: JournalKind[] = ["ok", "problem", "note"];

export interface JournalEntry {
  id: string;
  /** Moment wpisu (ms). */
  at: number;
  kind: JournalKind;
  /** Temat z materiału, którego dotyczy wpis; `null` = ogólny. */
  topic: string | null;
  text: string;
  /** Inwestycja / adres w chwili wpisu. */
  site: string;
  /** Punkty listy do nauki potwierdzone na budowie (id z `CHECKLIST`). */
  checked: string[];
}

export const JOURNAL_MAX_ENTRIES = 500;
export const JOURNAL_MAX_TEXT = 2000;
const SITE_MAX = 120;

export interface StudyState {
  /** Kolumna tablicy per temat; brak wpisu = „Do nauki”. */
  board: Record<string, Column>;
  /** Odhaczone punkty listy do nauki. */
  checked: Record<string, true>;
  /** Najlepszy wynik quizu w procentach (0–100) albo `null`. */
  bestPercent: number | null;
  rounds: number;
  /** Pytania, na które ostatnio odpowiedziano błędnie — materiał do „Powtórki błędów”. */
  missed: Record<string, true>;
  /** Dziennik z budowy, od najstarszego do najnowszego. */
  journal: JournalEntry[];
  /** Bieżąca inwestycja — podpowiada się przy kolejnych wpisach. */
  site: string;
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {}, journal: [], site: "" };

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
  const topicSet = new Set(TOPICS.map((t) => t.id));
  const journal: JournalEntry[] = [];
  for (const raw of Array.isArray(s.journal) ? s.journal : []) {
    const e = raw as Partial<JournalEntry> | null;
    if (!e || typeof e !== "object") continue;
    if (typeof e.id !== "string" || !e.id || e.id.length > 64) continue;
    if (typeof e.at !== "number" || !Number.isFinite(e.at)) continue;
    if (!JOURNAL_KINDS.includes(e.kind as JournalKind)) continue;
    const text = typeof e.text === "string" ? e.text.slice(0, JOURNAL_MAX_TEXT) : "";
    const topic = typeof e.topic === "string" && topicSet.has(e.topic) ? e.topic : null;
    const checkedIds = Array.isArray(e.checked) ? e.checked.filter((id): id is string => typeof id === "string" && itemIds.has(id)).slice(0, 60) : [];
    if (!text.trim() && checkedIds.length === 0) continue;
    journal.push({
      id: e.id, at: e.at, kind: e.kind as JournalKind, topic, text,
      site: typeof e.site === "string" ? e.site.slice(0, SITE_MAX) : "",
      checked: checkedIds,
    });
  }
  journal.sort((a, b) => a.at - b.at);
  const site = typeof s.site === "string" ? s.site.slice(0, SITE_MAX) : "";
  return { board, checked, bestPercent: best, rounds, missed, journal: journal.slice(-JOURNAL_MAX_ENTRIES), site };
}

const store = createPersistedStore<StudyState>("kaczy.study.v1", DEFAULTS, {
  merge: (defaults, stored) => sanitizeStudy(defaults, stored),
});

export const useStudy = () => store.use();
export const getStudy = () => store.get();

export function columnOf(state: StudyState, topicId: string): Column {
  return state.board[topicId] ?? "todo";
}

export function moveTopic(topicId: string, column: Column) {
  const s = store.get();
  const board = { ...s.board };
  if (column === "todo") delete board[topicId]; else board[topicId] = column;
  store.set({ ...s, board });
}

export function toggleChecked(itemId: string) {
  const s = store.get();
  const checked = { ...s.checked };
  if (checked[itemId]) delete checked[itemId]; else checked[itemId] = true;
  store.set({ ...s, checked });
}

export function resetChecklist() {
  store.set({ ...store.get(), checked: {} });
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
): { demoted: string[] } {
  const s = store.get();
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const board = { ...s.board };
  const demoted: string[] = [];
  for (const id of missed) {
    if (board[id] === "done") { board[id] = "doing"; demoted.push(id); }
  }
  const missedQuestions = { ...s.missed };
  for (const r of results) {
    if (r.ok) delete missedQuestions[r.id]; else missedQuestions[r.id] = true;
  }
  store.set({
    ...s,
    board,
    missed: missedQuestions,
    rounds: s.rounds + 1,
    bestPercent: s.bestPercent === null ? percent : Math.max(s.bestPercent, percent),
  });
  return { demoted };
}

export interface NewJournalEntry {
  kind: JournalKind;
  topic: string | null;
  text: string;
  checked?: string[];
}

/**
 * Dopisuje wpis z budowy. Problem przy temacie z kolumny „Umiem” cofa go do „W trakcie” —
 * teoria nie wytrzymała praktyki, więc wraca do powtórki (i na początek quizu).
 */
export function addJournalEntry(input: NewJournalEntry, now: number = Date.now()): JournalEntry | null {
  const text = input.text.trim().slice(0, JOURNAL_MAX_TEXT);
  const checked = (input.checked ?? []).filter((id) => CHECKLIST.some((c) => c.id === id));
  if (!text && checked.length === 0) return null;
  const s = store.get();
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: now,
    kind: input.kind,
    topic: input.topic && TOPICS.some((t) => t.id === input.topic) ? input.topic : null,
    text,
    site: s.site,
    checked,
  };
  const board = { ...s.board };
  if (entry.kind === "problem" && entry.topic && board[entry.topic] === "done") board[entry.topic] = "doing";
  store.set({ ...s, board, journal: [...s.journal, entry].sort((a, b) => a.at - b.at).slice(-JOURNAL_MAX_ENTRIES) });
  return entry;
}

/** Przywraca usunięty wpis (Cofnij) na właściwe miejsce w czasie. */
export function restoreJournalEntry(entry: JournalEntry) {
  const s = store.get();
  if (s.journal.some((e) => e.id === entry.id)) return;
  store.set({ ...s, journal: [...s.journal, entry].sort((a, b) => a.at - b.at).slice(-JOURNAL_MAX_ENTRIES) });
}

export function removeJournalEntry(id: string): JournalEntry | null {
  const s = store.get();
  const found = s.journal.find((e) => e.id === id) ?? null;
  if (found) store.set({ ...s, journal: s.journal.filter((e) => e.id !== id) });
  return found;
}

export function setSite(site: string) {
  store.set({ ...store.get(), site: site.slice(0, SITE_MAX) });
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
