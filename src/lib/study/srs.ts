import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from "ts-fsrs";
import { addDaysToKey } from "@/lib/week";

/**
 * Powtórki pytań quizu — FSRS (decyzja P-6, biblioteka `ts-fsrs`). Dwa wyniki: „Dobrze” = Good,
 * „Od nowa” = Again. Nie pytamy o samoocenę — na budowie liczy się jedno stuknięcie.
 *
 * Bez losowości (`enable_fuzz` wyłączony) i bez kroków w ciągu dnia (`enable_short_term`): dane
 * synchronizują się przez Yjs, więc każde urządzenie ma policzyć to samo, a odstęp to co najmniej dzień.
 *
 * Karta trzyma dni jako klucze „2026-10-15” (lokalny dzień), nie milisekundy: termin „na jutro”
 * ma znaczyć jutro, niezależnie od godziny rundy.
 */
export interface ReviewCard {
  /** Dobre odpowiedzi z rzędu (zero po błędzie). */
  reps: number;
  /** Odstęp do następnej powtórki w dniach. */
  interval: number;
  /** Łatwość z dawnego SM-2 (min. 1,3). Już nie wpływa na terminy; służy tylko do trudności kart sprzed FSRS. */
  ease: number;
  /** Dzień następnej powtórki. */
  due: string;
  /** Dzień ostatniej odpowiedzi. */
  last: string;
  /** Pomyłki łącznie — „trudne” pytania (statystyki). */
  lapses: number;
  /** Odpowiedzi łącznie i dobre odpowiedzi — trafność (statystyki); brak w kartach sprzed N4. */
  seen: number;
  right: number;
  /** Stan FSRS: stabilność w dniach, trudność 1–10, stan (0 nowa, 1 nauka, 2 powtórka, 3 ponowna nauka). Brak w kartach sprzed FSRS. */
  stability?: number;
  difficulty?: number;
  state?: number;
}

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
export const EASE_MAX = 5;
/** Najdłuższy odstęp — po pół roku pytanie i tak warto zobaczyć. */
export const INTERVAL_MAX = 180;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const STABILITY_MAX = 36_500;

const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false, maximum_interval: INTERVAL_MAX }));

/** Dzień klucza jako data w południe, żeby strefa czasu nie przesunęła dnia. */
const dayDate = (key: string): Date => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
};

/**
 * Karta w formie FSRS. Stare karty (bez pól FSRS) dostają stabilność z dotychczasowego odstępu
 * i trudność z łatwości SM-2: 1,3 → 10, 2,5 → ok. 7, 5 → 1.
 */
function toFsrs(card: ReviewCard): Card {
  const last_review = dayDate(card.last);
  const due = dayDate(card.due);
  if (card.stability !== undefined && card.difficulty !== undefined && card.state !== undefined) {
    return {
      due, stability: card.stability, difficulty: card.difficulty, state: card.state as State,
      reps: card.reps, lapses: card.lapses, scheduled_days: card.interval, learning_steps: 0, elapsed_days: 0, last_review,
    };
  }
  const difficulty = 10 - ((card.ease - EASE_MIN) * 9) / (EASE_MAX - EASE_MIN);
  return {
    due, stability: Math.max(0.5, card.interval), difficulty: Math.min(10, Math.max(1, difficulty)), state: State.Review,
    reps: card.reps, lapses: card.lapses, scheduled_days: card.interval, learning_steps: 0, elapsed_days: 0, last_review,
  };
}

/**
 * Następny stan karty po odpowiedzi. Liczniki rosną zawsze; harmonogram — raz na dzień
 * (druga dobra odpowiedź tego samego dnia, np. „Jeszcze raz”, nie przesuwa terminu).
 * Błąd wraca do nauki i liczy się do pomyłek.
 */
export function reviewCard(prev: ReviewCard | undefined, ok: boolean, today: string): ReviewCard {
  const seen = (prev?.seen ?? 0) + 1;
  if (ok && prev && prev.last === today && prev.reps > 0) return { ...prev, seen, right: prev.right + 1 };
  const base = prev ?? { reps: 0, interval: 0, ease: EASE_START, due: today, last: today, lapses: 0, seen: 0, right: 0 };
  const current = prev ? toFsrs(prev) : createEmptyCard(dayDate(today));
  const next = scheduler.next(current, dayDate(today), ok ? Rating.Good : Rating.Again).card;
  // Sufit też po naszej stronie: biblioteka potrafi oddać o dzień więcej niż `maximum_interval`.
  const days = Math.min(INTERVAL_MAX, Math.max(1, Math.round(next.scheduled_days)));
  return {
    reps: ok ? base.reps + 1 : 0,
    interval: days,
    ease: base.ease,
    due: addDaysToKey(today, days),
    last: today,
    lapses: ok ? base.lapses : base.lapses + 1,
    seen,
    right: ok ? base.right + 1 : base.right,
    stability: next.stability,
    difficulty: next.difficulty,
    state: next.state,
  };
}

/** Pytania należne do powtórki (termin dziś lub wcześniej), od najbardziej zaległych. */
export function dueIds(reviews: Readonly<Record<string, ReviewCard>>, today: string): string[] {
  return Object.entries(reviews)
    .filter(([, c]) => c.due <= today)
    .sort(([a, x], [b, y]) => (x.due < y.due ? -1 : x.due > y.due ? 1 : a < b ? -1 : 1))
    .map(([id]) => id);
}

/** Dowolne wejście (peer, kopia) → karta albo `null`. */
export function cleanCard(raw: unknown): ReviewCard | null {
  const c = raw as Partial<ReviewCard> | null;
  if (!c || typeof c !== "object") return null;
  if (typeof c.due !== "string" || !DAY_RE.test(c.due) || typeof c.last !== "string" || !DAY_RE.test(c.last)) return null;
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  // Pola FSRS tylko w komplecie; niepełne (uszkodzone) są pomijane, karta policzy się od pól SM-2.
  const fsrsPart = typeof c.stability === "number" && typeof c.difficulty === "number" && typeof c.state === "number"
    && Number.isFinite(c.stability) && Number.isFinite(c.difficulty) && Number.isFinite(c.state)
    ? {
      stability: num(c.stability, 0, STABILITY_MAX, 1),
      difficulty: num(c.difficulty, 1, 10, 5),
      state: Math.floor(num(c.state, 0, 3, 2)),
    }
    : {};
  return {
    reps: Math.floor(num(c.reps, 0, 10_000, 0)),
    interval: Math.floor(num(c.interval, 0, INTERVAL_MAX, 1)),
    ease: num(c.ease, EASE_MIN, EASE_MAX, EASE_START),
    due: c.due,
    last: c.last,
    lapses: Math.floor(num(c.lapses, 0, 10_000, 0)),
    // Karty sprzed N4 bez liczników: odpowiedzi co najmniej tyle, ile pomyłek + dobre z rzędu.
    seen: Math.floor(num(c.seen, 0, 100_000, num(c.lapses, 0, 10_000, 0) + num(c.reps, 0, 10_000, 0))),
    right: Math.floor(num(c.right, 0, 100_000, num(c.reps, 0, 10_000, 0))),
    ...fsrsPart,
  };
}
