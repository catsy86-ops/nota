import { createPersistedStore } from "@/lib/persistedStore";
import { TOPICS } from "./content";

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
}

const DEFAULTS: StudyState = { board: {}, checked: {}, bestPercent: null, rounds: 0 };

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
  const checked: Record<string, true> = {};
  for (const [id, v] of Object.entries(s.checked ?? {})) if (v === true) checked[id] = true;
  const best = typeof s.bestPercent === "number" && s.bestPercent >= 0 && s.bestPercent <= 100 ? Math.round(s.bestPercent) : null;
  const rounds = typeof s.rounds === "number" && s.rounds >= 0 ? Math.floor(s.rounds) : 0;
  return { board, checked, bestPercent: best, rounds };
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

/** Zapisuje wynik rundy; tematy z błędami wracają z „Umiem” do „W trakcie”. */
export function recordRound(correct: number, total: number, missed: string[]): { demoted: string[] } {
  const s = store.get();
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const board = { ...s.board };
  const demoted: string[] = [];
  for (const id of missed) {
    if (board[id] === "done") { board[id] = "doing"; demoted.push(id); }
  }
  store.set({
    ...s,
    board,
    rounds: s.rounds + 1,
    bestPercent: s.bestPercent === null ? percent : Math.max(s.bestPercent, percent),
  });
  return { demoted };
}
