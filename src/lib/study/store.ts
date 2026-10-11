import { createPersistedStore } from "@/lib/persistedStore";
import { CHECKLIST, QUESTIONS, TOPICS } from "./content";

export type Column = "todo" | "doing" | "done";
export const COLUMNS: Column[] = ["todo", "doing", "done"];

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
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0, missed: {} };

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
  return { board, checked, bestPercent: best, rounds, missed };
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
