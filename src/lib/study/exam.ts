import type { RoundQuestion } from "./quiz";

/** Egzamin próbny (P-3): ogólny sprawdzian działu, bez nazwy egzaminu (decyzja P-3). */
export const EXAM_SIZE = 20;
/** Limit czasu egzaminu w sekundach (30 min na 20 pytań). */
export const EXAM_SECONDS = 30 * 60;
/** Ile ostatnich wyników trzymamy w dokumencie. */
export const EXAM_KEEP = 30;

export interface ExamResult {
  id: string;
  /** Moment zakończenia (ms). */
  at: number;
  correct: number;
  total: number;
  /** Czas od startu do zakończenia w sekundach, najwyżej limit. */
  seconds: number;
  /** Temat → [dobrze, razem]. */
  byTopic: Record<string, [number, number]>;
}

/** Wynik po pytaniach: nieodpowiedziane liczą się jako błędne (także przy przekroczeniu czasu). */
export function examResult(questions: readonly RoundQuestion[], answers: readonly (number | null)[]): {
  correct: number;
  total: number;
  byTopic: Record<string, [number, number]>;
} {
  const byTopic: Record<string, [number, number]> = {};
  let correct = 0;
  questions.forEach((q, i) => {
    const ok = answers[i] === q.correct;
    if (ok) correct++;
    const [good, all] = byTopic[q.topic] ?? [0, 0];
    byTopic[q.topic] = [good + (ok ? 1 : 0), all + 1];
  });
  return { correct, total: questions.length, byTopic };
}

/** Tematy z błędami, najgorsze pierwsze (najmniejszy udział dobrych odpowiedzi). */
export function weakTopicsOf(byTopic: Record<string, [number, number]>): string[] {
  return Object.entries(byTopic)
    .filter(([, [good, all]]) => good < all)
    .sort(([, [ag, aa]], [, [bg, ba]]) => ag / aa - bg / ba)
    .map(([topic]) => topic);
}

const isCount = (n: unknown, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;

/** Wynik z dokumentu (peer, kopia) → poprawny `ExamResult` albo `null`. */
export function cleanExam(raw: unknown): ExamResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof ExamResult, unknown>>;
  if (typeof r.id !== "string" || r.id.length === 0 || r.id.length > 200) return null;
  if (typeof r.at !== "number" || !Number.isFinite(r.at)) return null;
  if (!isCount(r.total, 100) || !isCount(r.correct, r.total as number)) return null;
  if (!isCount(r.seconds, EXAM_SECONDS * 2)) return null;
  const byTopic: Record<string, [number, number]> = {};
  if (r.byTopic && typeof r.byTopic === "object") {
    for (const [topic, pair] of Object.entries(r.byTopic as Record<string, unknown>)) {
      if (topic.length > 200 || !Array.isArray(pair) || pair.length !== 2) continue;
      const [good, all] = pair;
      if (isCount(all, 100) && isCount(good, all)) byTopic[topic] = [good, all];
    }
  }
  return { id: r.id, at: r.at, correct: r.correct as number, total: r.total as number, seconds: r.seconds as number, byTopic };
}

/** Ostatnie `EXAM_KEEP` wyników od najstarszego (kolejność zapisu w dokumencie i w statystykach). */
export function keepLatestExams(list: readonly ExamResult[]): ExamResult[] {
  return [...list].sort((a, b) => a.at - b.at).slice(-EXAM_KEEP);
}
