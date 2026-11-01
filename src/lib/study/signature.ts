import { isImageRef } from "@/lib/imageStore";

/**
 * P2.4: podpis klienta na protokole odbioru. Obraz (PNG z pola podpisu) leży w `imageStore` jak
 * zdjęcia wpisów; karta budowy (`SiteCard.signature`) trzyma tylko klucz, imię i moment podpisu.
 * Podpis to dane osobowe: jedzie z kartą w kopii i synchronizacji (`journalRefsIn`), ale nie
 * w paczce ZIP ani w tekście protokołu. Usunięcie zdejmuje go z karty na wszystkich urządzeniach;
 * bajty sprząta `collectGarbage` (najpóźniej 7 dni od zapisu), starsze kopie danych i PDF-y zostają.
 */
export interface SiteSignature {
  /** Klucz bajtów PNG w `imageStore` (SHA-256). */
  image: string;
  /** Imię i nazwisko podpisującego, tak jak wpisał wykonawca. */
  name: string;
  /** Moment podpisu (ms). */
  at: number;
}

export const SIGNATURE_NAME_MAX = 80;

/** Podpis w znanym kształcie albo `undefined` (brak, uszkodzony, obcy klucz). */
export function cleanSignature(raw: unknown): SiteSignature | undefined {
  const s = raw as Partial<SiteSignature> | null;
  if (!s || typeof s !== "object" || typeof s.image !== "string" || !isImageRef(s.image)) return undefined;
  if (typeof s.at !== "number" || !Number.isFinite(s.at) || s.at <= 0) return undefined;
  // Bez znaków sterujących i przełączników kierunku tekstu — imienia na protokole nie da się wizualnie podrobić.
  const name = typeof s.name === "string"
    ? s.name.replace(/[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, " ").replace(/\s+/g, " ").trim().slice(0, SIGNATURE_NAME_MAX)
    : "";
  return { image: s.image, name, at: s.at };
}
