/**
 * Znaki sterujące (C0, C1) i przełączniki kierunku tekstu (U+200E/F, U+202A–202E, U+2066–2069).
 * Tekst z innego urządzenia albo z kopii trafia do PDF-ów i nazw plików dla klienta — te znaki
 * pozwoliłyby dopisać fałszywą linię albo wizualnie odwrócić tekst (np. rozszerzenie pliku).
 */
const UNSAFE = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Jedna linia bez znaków sterujących i przełączników kierunku; białe znaki zwinięte. */
export const safeLine = (s: string) => s.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
