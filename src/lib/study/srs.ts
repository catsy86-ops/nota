import { addDaysToKey } from "@/lib/week";

/**
 * Powtórki pytań quizu — SM-2 w wersji „lite” z oceną automatyczną:
 * dobra odpowiedź = „dobrze” (q 4), zła = „od nowa” (q 1). Nie pytamy
 * o samoocenę — na budowie liczy się jedno stuknięcie.
 *
 * Karta trzyma dni jako klucze „2026-10-15” (lokalny dzień), nie milisekundy:
 * termin „na jutro” ma znaczyć jutro, niezależnie od godziny rundy.
 */
export interface ReviewCard {
  /** Dobre odpowiedzi z rzędu (zero po błędzie). */
  reps: number;
  /** Odstęp do następnej powtórki w dniach. */
  interval: number;
  /** Łatwość SM-2 (min. 1,3). */
  ease: number;
  /** Dzień następnej powtórki. */
  due: string;
  /** Dzień ostatniej odpowiedzi. */
  last: string;
  /** Pomyłki łącznie — „trudne” pytania (statystyki). */
  lapses: number;
}

export const EASE_START = 2.5;
export const EASE_MIN = 1.3;
/** Najdłuższy odstęp — po pół roku pytanie i tak warto zobaczyć. */
export const INTERVAL_MAX = 180;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Następny stan karty po odpowiedzi. Pierwsze dobre odpowiedzi: 1 dzień, potem 3,
 * dalej odstęp × łatwość. Błąd: od nowa jutro, łatwość −0,2. Druga odpowiedź tego
 * samego dnia (np. „Jeszcze raz”) nie wydłuża odstępu — liczy się raz na dzień;
 * błąd liczy się zawsze.
 */
export function reviewCard(prev: ReviewCard | undefined, ok: boolean, today: string): ReviewCard {
  const card = prev ?? { reps: 0, interval: 0, ease: EASE_START, due: today, last: today, lapses: 0 };
  if (!ok) {
    return { reps: 0, interval: 1, ease: Math.max(EASE_MIN, round2(card.ease - 0.2)), due: addDaysToKey(today, 1), last: today, lapses: card.lapses + 1 };
  }
  if (prev && prev.last === today && prev.reps > 0) return prev;
  const reps = card.reps + 1;
  const interval = Math.min(INTERVAL_MAX, reps === 1 ? 1 : reps === 2 ? 3 : Math.round(card.interval * card.ease));
  return { reps, interval, ease: card.ease, due: addDaysToKey(today, interval), last: today, lapses: card.lapses };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pytania należne do powtórki (termin dziś lub wcześniej), od najbardziej zaległych. */
export function dueIds(reviews: Readonly<Record<string, ReviewCard>>, today: string, known?: ReadonlySet<string>): string[] {
  return Object.entries(reviews)
    .filter(([id, c]) => c.due <= today && (!known || known.has(id)))
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
  return {
    reps: Math.floor(num(c.reps, 0, 10_000, 0)),
    interval: Math.floor(num(c.interval, 0, INTERVAL_MAX, 1)),
    ease: num(c.ease, EASE_MIN, 5, EASE_START),
    due: c.due,
    last: c.last,
    lapses: Math.floor(num(c.lapses, 0, 10_000, 0)),
  };
}
