import type { TargetAndTransition } from "framer-motion";
import { dur, ease } from "@/lib/motion";

// Ruch kart notatek: kaskada wejścia, wyjście zależne od akcji i „stempel” przypięcia.
// Same `transform`/`opacity` — bezpieczne przy setkach kart.

/** Ile pierwszych kart dostaje opóźnienie kaskady; reszta wchodzi od razu. */
const CASCADE_CARDS = 6;
const CASCADE_STEP = 0.035;

export function cascadeDelay(index: number, reduced: boolean): number {
  if (reduced || index >= CASCADE_CARDS) return 0;
  return index * CASCADE_STEP;
}

export type CardExitKind = "trash" | "archive";
export interface CardExitIntent {
  id: string;
  kind: CardExitKind;
}

/**
 * Wyjście karty. Archiwizacja „odkłada” kartkę na stos (opada i lekko się
 * przechyla), kosz zsuwa ją w bok jak zgarniętą z biurka. Bez intencji — krótkie
 * przygaszenie, jak dotąd.
 */
export function cardExit(intent: CardExitIntent | undefined, id: string, reduced: boolean): TargetAndTransition {
  if (reduced) return { opacity: 0, transition: { duration: dur.fast } };
  const out = { duration: dur.base, ease: ease.in };
  if (intent && intent.id === id) {
    if (intent.kind === "archive") return { opacity: 0, y: 16, scale: 0.92, rotate: 1.5, transition: out };
    return { opacity: 0, x: -32, y: 6, scale: 0.94, rotate: -3, transition: out };
  }
  return { opacity: 0, scale: 0.98, transition: { duration: dur.fast, ease: ease.in } };
}

// Przypięcie przenosi notatkę do innej sekcji (karta montuje się od nowa), więc
// „stempel” zapamiętujemy poza komponentem i odtwarzamy na nowo zamontowanej karcie.
const recentlyPinned = new Set<string>();

export function markPinned(id: string) {
  recentlyPinned.add(id);
  // Zabezpieczenie: jeśli karta się nie pojawi (inny widok), nie zostawiamy śmieci.
  setTimeout(() => recentlyPinned.delete(id), 3000);
}
export function hasRecentPin(id: string): boolean {
  return recentlyPinned.has(id);
}
export function consumePin(id: string) {
  recentlyPinned.delete(id);
}
