import { isImageRef } from "@/lib/imageStore";
import { yjsStore } from "@/lib/yjsStore";
import { JOURNAL_DRAFT_KEY, STUDY_STORAGE_KEY } from "./keys";
import { legacyStudyMerged } from "./data";
import { journalRefsIn } from "./yStudy";
import { journalEditImageRefs } from "./entrySheet";

export { JOURNAL_DRAFT_KEY, STUDY_STORAGE_KEY };

/**
 * Klucze obrazów używanych w dzienniku z budowy: wpisy w dokumencie (te zna też
 * `yjsStore.referencedImages()`), niezapisany szkic wpisu i otwarta edycja — ich
 * zdjęcia leżą w `imageStore`, zanim wpis się zapisze — i dawny zapis z localStorage, dopóki
 * to urządzenie go nie przeniosło. Bez tej listy zdjęcia znikałyby po karencji.
 *
 * Bez `store.ts`: ten moduł jest w głównej paczce (odśmiecanie, kopia
 * zapasowa), a sklep ciągnie za sobą cały materiał do nauki (`content.ts`).
 */
export function journalImageRefs(): Set<string> {
  const refs = journalRefsIn(yjsStore.doc);
  const addFrom = (images: unknown) => {
    if (Array.isArray(images)) for (const r of images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
  };
  if (!legacyStudyMerged()) {
    try {
      const raw = localStorage.getItem(STUDY_STORAGE_KEY);
      const journal: unknown = raw ? JSON.parse(raw)?.journal : null;
      if (Array.isArray(journal)) for (const e of journal) addFrom(e?.images);
    } catch {
      /* uszkodzony zapis — migracja go nie przeniesie */
    }
  }
  addFrom(journalEditImageRefs());
  try {
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY);
    addFrom(raw ? JSON.parse(raw)?.images : null);
  } catch {
    /* uszkodzony szkic — szkic wróci pusty */
  }
  return refs;
}
