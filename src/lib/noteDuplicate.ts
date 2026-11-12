import { fold } from "@/lib/fold";

/** Tytuł do porównania: bez ogonków, wielkości liter, interpunkcji i podwójnych spacji („Zakupy, sobota!” = „zakupy sobota”). */
export const titleKey = (title: string): string => fold(title).replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Plan Notatek 3.5: istniejąca notatka o tym samym tytule co tworzona (po `titleKey`), żeby zaproponować jej otwarcie
 * zamiast drugiej kopii. Krótkie tytuły (poniżej 3 znaków) nie są sprawdzane — „Do” albo „A” to nie duplikat.
 * Notatki w koszu się nie liczą.
 */
export function findTitleDuplicate<T extends { id: string; title: string; trashed?: boolean }>(title: string, notes: readonly T[]): T | null {
  const key = titleKey(title);
  if (key.length < 3) return null;
  return notes.find((n) => !n.trashed && titleKey(n.title) === key) ?? null;
}
