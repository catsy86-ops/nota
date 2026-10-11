import { QUESTIONS, type Question } from "./content";

export interface RoundQuestion {
  id: string;
  topic: string;
  question: string;
  options: string[];
  /** Indeks poprawnej odpowiedzi w `options` (po wymieszaniu). */
  correct: number;
  explanation: string;
}

export type Rng = () => number;

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toRoundQuestion(q: Question, rng: Rng): RoundQuestion {
  const tagged = q.options.map((text, i) => ({ text, right: i === 0 }));
  const options = shuffle(tagged, rng);
  return {
    id: q.id,
    topic: q.topic,
    question: q.question,
    options: options.map((o) => o.text),
    correct: options.findIndex((o) => o.right),
    explanation: q.explanation,
  };
}

/**
 * Runda quizu: `size` pytań w losowej kolejności, z pierwszeństwem dla tematów,
 * których jeszcze nie umiesz (`weakTopics`); odpowiedzi też są mieszane.
 */
export function buildRound(
  size: number,
  weakTopics: ReadonlySet<string> = new Set(),
  rng: Rng = Math.random,
  pool: readonly Question[] = QUESTIONS,
): RoundQuestion[] {
  const shuffled = shuffle(pool, rng);
  const weak = shuffled.filter((q) => weakTopics.has(q.topic));
  const rest = shuffled.filter((q) => !weakTopics.has(q.topic));
  return shuffle([...weak, ...rest].slice(0, size), rng).map((q) => toRoundQuestion(q, rng));
}

/** Tematy z błędnych odpowiedzi, bez powtórzeń, w kolejności pierwszego błędu. */
export function missedTopics(questions: readonly RoundQuestion[], answers: readonly (number | null)[]): string[] {
  const out: string[] = [];
  questions.forEach((q, i) => {
    if (answers[i] !== q.correct && !out.includes(q.topic)) out.push(q.topic);
  });
  return out;
}

export function scoreRound(questions: readonly RoundQuestion[], answers: readonly (number | null)[]): number {
  return questions.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
}
