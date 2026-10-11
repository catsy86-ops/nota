import { getStudy } from "./store";

/**
 * Klucze obrazów używanych w dzienniku z budowy. Odśmiecanie `imageStore` zna tylko notatki,
 * więc bez tej listy zdjęcia z dziennika znikałyby po tygodniu karencji.
 */
export function journalImageRefs(): Set<string> {
  const refs = new Set<string>();
  for (const e of getStudy().journal) for (const r of e.images) refs.add(r);
  return refs;
}
