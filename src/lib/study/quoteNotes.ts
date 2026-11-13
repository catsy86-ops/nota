/**
 * Uwagi i warunki wyceny (plan wycen i klientów, 3.3): limit i czyszczenie tekstu. Osobny plik bez zależności, bo ten sam
 * tekst czyta `companyPrefs.ts` (domyślne warunki w Ustawieniach), a ten moduł jest w ścieżce startowej — nie może wciągać
 * całego `quoteDoc.ts` (numeracja, rabaty, VAT).
 */

export const QUOTE_NOTES_MAX = 500;

/** Uwagi: wiele linii dozwolone, znaki sterujące (poza nową linią) i przełączniki kierunku tekstu wycięte. */
export function cleanNotes(v: unknown): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  const t = v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g, " ");
  return t.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, QUOTE_NOTES_MAX);
}
