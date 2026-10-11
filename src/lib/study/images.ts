import { isImageRef } from "@/lib/imageStore";

/** Klucz zapisu stanu Nauki (`store.ts`). */
export const STUDY_STORAGE_KEY = "kaczy.study.v1";

/**
 * Klucze obrazów używanych w dzienniku z budowy. Odśmiecanie `imageStore` zna tylko notatki,
 * więc bez tej listy zdjęcia z dziennika znikałyby po tygodniu karencji.
 *
 * Czyta zapisany stan wprost, bez `store.ts`: ten moduł jest w głównej paczce (odśmiecanie,
 * kopia zapasowa), a sklep ciągnie za sobą cały materiał do nauki (`content.ts`).
 */
export function journalImageRefs(): Set<string> {
  const refs = new Set<string>();
  try {
    const raw = localStorage.getItem(STUDY_STORAGE_KEY);
    const journal: unknown = raw ? JSON.parse(raw)?.journal : null;
    if (!Array.isArray(journal)) return refs;
    for (const e of journal) {
      const images: unknown = e?.images;
      if (Array.isArray(images)) for (const r of images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
    }
  } catch {
    /* uszkodzony zapis — sklep i tak wróci do wartości domyślnych */
  }
  return refs;
}
