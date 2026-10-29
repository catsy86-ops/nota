import { TOPICS } from "./content";
import { CUSTOM_MAX, CUSTOM_PREFIX, CUSTOM_TEXT_MAX, cleanCustom, type CustomEntry, type CustomItem, type CustomQuestion } from "./custom";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import { studyDevice, yStudy } from "./data";
import { dueIds } from "./srs";
import { type Column, type StudyState } from "./yStudy";
import { type ExamResult } from "./exam";
import { getStudy } from "./studyProjection";

/** Akcje nauki (H0.2, z `store.ts`): tablica, odhaczenia, rundy, egzaminy, własne pytania i punkty. */

/** Seria, która jeszcze trwa: ostatnia runda dziś albo wczoraj; starsza już przepadła. */
export function activeStreak(state: Pick<StudyState, "streak" | "lastDay">, today = localDayKey()): number {
  if (!state.lastDay) return 0;
  return state.lastDay === today || state.lastDay === addDaysToKey(today, -1) ? state.streak : 0;
}

/** Pytania do powtórki na dziś (termin minął), od najbardziej zaległych — „Na dziś: N”. */
export function dueToday(state: Pick<StudyState, "review">, today = localDayKey()): string[] {
  return dueIds(state.review, today);
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

/** Czyści odhaczenia; zwraca, co było odhaczone — do „Cofnij”. */
export function resetChecklist(): string[] {
  const ids = Object.keys(getStudy().checked);
  yStudy.clearChecked();
  return ids;
}

export function restoreChecklist(ids: string[]) {
  yStudy.restoreChecked(ids);
}

/** Wynik egzaminu próbnego bez wpływu na powtórki i serię (P-3). Zwraca zapisany wynik z id. */
export function recordExam(data: Omit<ExamResult, "id">): ExamResult {
  const exam: ExamResult = { ...data, id: `${studyDevice()}-${data.at}` };
  yStudy.recordExam(exam);
  return exam;
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

/** Własne punkty i pytania (N5): zapis tylko dla znanego tematu i w limicie. `null` = odrzucone. */
function addCustomEntry(entry: CustomEntry | null): CustomEntry | null {
  if (!entry || !TOPICS.some((t) => t.id === entry.topic)) return null;
  if (getStudy().custom.length >= CUSTOM_MAX) return null;
  yStudy.addCustom(entry);
  return entry;
}

export function addCustomItem(topic: string, text: string): CustomItem | null {
  const t = text.trim();
  if (!t || t.length > CUSTOM_TEXT_MAX) return null;
  return addCustomEntry(cleanCustom({ kind: "item", id: CUSTOM_PREFIX + crypto.randomUUID(), topic, text: t })) as CustomItem | null;
}

export interface CustomQuestionInput {
  topic: string;
  question: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
}

/** `null` = niepoprawne (np. dwie takie same odpowiedzi, za długie pole). */
export function addCustomQuestion(input: CustomQuestionInput): CustomQuestion | null {
  const raw = { kind: "question", id: CUSTOM_PREFIX + crypto.randomUUID(), ...input };
  return addCustomEntry(cleanCustom(raw)) as CustomQuestion | null;
}

/** Zmiana własnego pytania bez utraty historii powtórek (§4 P6). `null` = nie ma takiego pytania albo treść odrzucona. */
export function updateCustomQuestion(id: string, input: CustomQuestionInput): CustomQuestion | null {
  const prev = getStudy().custom.find((e) => e.id === id);
  if (!prev || prev.kind !== "question" || !TOPICS.some((t) => t.id === input.topic)) return null;
  const cleaned = cleanCustom({ kind: "question", id, ...input });
  if (!cleaned || cleaned.kind !== "question") return null;
  yStudy.updateCustom(cleaned);
  return cleaned;
}

/** Usuwa własny wpis; zwraca go do „Cofnij”. */
export function removeCustomEntry(id: string): CustomEntry | null {
  return yStudy.removeCustom(id);
}

export function restoreCustomEntry(entry: CustomEntry) {
  yStudy.restoreCustom(entry);
}
