import type { Question } from "./content";
import { foldName } from "./siteKey";

/**
 * P4.2 Szukanie pytań quizu bez polskich znaków: „szczelnosc” znajdzie „szczelność”. Każde słowo
 * zapytania musi wystąpić w pytaniu, odpowiedziach albo objaśnieniu. Najpierw trafienia w treści pytania.
 */
export function searchQuestions(questions: readonly Question[], query: string, limit = 5): Question[] {
  const words = foldName(query).split(" ").filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  const hits: { q: Question; inQuestion: boolean }[] = [];
  for (const q of questions) {
    const head = foldName(q.question);
    const all = `${head} ${foldName(q.options.join(" "))} ${foldName(q.explanation)}`;
    if (words.every((w) => all.includes(w))) hits.push({ q, inQuestion: words.every((w) => head.includes(w)) });
  }
  hits.sort((a, b) => Number(b.inQuestion) - Number(a.inQuestion));
  return hits.slice(0, limit).map((h) => h.q);
}

/** `/praca?temat=<id>` — quiz z tego tematu (z wyniku szukania pytań w palecie). */
export const STUDY_TOPIC_PARAM = "temat";
