/**
 * Klucze budów i nazw bez zależności od reszty działu Praca. Wydzielone z `sites.ts`,
 * żeby `siteHours.ts` nie musiał importować `sites.ts` (cykl w czasie działania).
 */
import type { JournalEntry } from "./yStudy";

export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/Ł/g, "l").toLowerCase();

/** Nazwa do porównań: bez ogonków, wielkości liter i podwójnych spacji. */
export const foldName = (s: string) => fold(s).replace(/\s+/g, " ").trim();

/** Id budowy ze starej nazwy tekstowej — to samo na każdym urządzeniu. */
export function siteKey(name: string): string {
  let h = 0x811c9dc5;
  for (const ch of foldName(name)) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `n-${h.toString(16).padStart(8, "0")}`;
}

/** Budowa wpisu; `""` = bez budowy. */
export const entrySiteId = (e: Pick<JournalEntry, "site" | "siteId">): string =>
  e.siteId || (e.site.trim() ? siteKey(e.site) : "");
