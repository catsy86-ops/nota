import { isImageRef } from "@/lib/imageStore";

/** Klucz zapisu stanu Nauki (`store.ts`). */
export const STUDY_STORAGE_KEY = "kaczy.study.v1";
/** Klucz niezapisanego wpisu do dziennika (`draft.ts`). */
export const JOURNAL_DRAFT_KEY = "kaczy.study.draft.v1";

/**
 * Klucze obrazów używanych w dzienniku z budowy. Odśmiecanie `imageStore` zna tylko notatki,
 * więc bez tej listy zdjęcia z dziennika znikałyby po tygodniu karencji. Obejmuje też zdjęcia
 * z niezapisanego szkicu wpisu — leżą w `imageStore`, zanim wpis powstanie.
 *
 * Czyta zapisany stan wprost, bez `store.ts`: ten moduł jest w głównej paczce (odśmiecanie,
 * kopia zapasowa), a sklep ciągnie za sobą cały materiał do nauki (`content.ts`).
 */
export function journalImageRefs(): Set<string> {
  const refs = new Set<string>();
  const addFrom = (images: unknown) => {
    if (Array.isArray(images)) for (const r of images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
  };
  try {
    const raw = localStorage.getItem(STUDY_STORAGE_KEY);
    const journal: unknown = raw ? JSON.parse(raw)?.journal : null;
    if (Array.isArray(journal)) for (const e of journal) addFrom(e?.images);
  } catch {
    /* uszkodzony zapis — sklep i tak wróci do wartości domyślnych */
  }
  try {
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
    addFrom(raw ? JSON.parse(raw)?.images : null);
  } catch {
    /* uszkodzony szkic — szkic wróci pusty */
  }
  return refs;
}
