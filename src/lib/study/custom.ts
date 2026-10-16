/**
 * Własne pytania quizu i własne punkty listy do nauki (N5).
 *
 * Trzymane w mapie Yjs `studyCustom` (klucz = id) obok materiału G-HEAT, który
 * jest statyczny. Id mają przedrostek `c-`, więc nie kolidują z materiałem.
 * Ten moduł nie zna tematów (to rola `store.ts`, które ma materiał) — tylko
 * kształt i limity, żeby śmieci od peera nie wywróciły widoku.
 */

export const CUSTOM_PREFIX = "c-";
export const CUSTOM_MAX = 200;
export const CUSTOM_TEXT_MAX = 300;
export const CUSTOM_ANSWER_MAX = 200;
export const CUSTOM_EXPLANATION_MAX = 500;

/** Pytanie z czterema odpowiedziami; `correct` to pierwsza odpowiedź przed mieszaniem (jak w materiale). */
export interface CustomQuestion {
  kind: "question";
  id: string;
  topic: string;
  question: string;
  correct: string;
  wrong: [string, string, string];
  explanation: string;
}

/** Własny punkt listy do nauki, przypięty do tematu. */
export interface CustomItem {
  kind: "item";
  id: string;
  topic: string;
  text: string;
}

export type CustomEntry = CustomQuestion | CustomItem;

export const isCustomId = (id: string): boolean => id.startsWith(CUSTOM_PREFIX) && id.length <= 64;

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n?/g, "\n").trim();
  return t.length > 0 && t.length <= max ? t : null;
};

/**
 * Kształt jednego wpisu; `null` = nie do uratowania. Temat sprawdza `store.ts`.
 * Pytanie z czterema różnymi odpowiedziami — inaczej quiz pokazałby dwa takie same przyciski.
 */
export function cleanCustom(raw: unknown): CustomEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || !isCustomId(e.id)) return null;
  const topic = str(e.topic, 64);
  if (!topic) return null;
  if (e.kind === "item") {
    const text = str(e.text, CUSTOM_TEXT_MAX);
    return text ? { kind: "item", id: e.id, topic, text } : null;
  }
  if (e.kind === "question") {
    const question = str(e.question, CUSTOM_TEXT_MAX);
    const correct = str(e.correct, CUSTOM_ANSWER_MAX);
    const w = Array.isArray(e.wrong) ? e.wrong.map((x) => str(x, CUSTOM_ANSWER_MAX)) : [];
    if (!question || !correct || w.length !== 3 || w.some((x) => x === null)) return null;
    const wrong = w as [string, string, string];
    if (new Set([correct, ...wrong]).size !== 4) return null;
    // Wyjaśnienie nie jest krytyczne: za długie przycinamy, zamiast odrzucać całe pytanie.
    const explanation = typeof e.explanation === "string" ? e.explanation.trim().slice(0, CUSTOM_EXPLANATION_MAX) : "";
    return { kind: "question", id: e.id, topic, question, correct, wrong, explanation };
  }
  return null;
}

/** Lista z mapy: tylko poprawne wpisy, bez duplikatów id, do limitu. */
export function cleanCustomList(raw: unknown): CustomEntry[] {
  const values = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  const seen = new Set<string>();
  const out: CustomEntry[] = [];
  for (const v of values) {
    const e = cleanCustom(v);
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
    if (out.length >= CUSTOM_MAX) break;
  }
  return out;
}

/** Odpowiedzi w kolejności materiału: poprawna pierwsza (`quiz.ts` miesza je sam). */
export function questionOptions(q: CustomQuestion): [string, string, string, string] {
  return [q.correct, ...q.wrong];
}
