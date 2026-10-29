export { COLUMNS, JOURNAL_KINDS, JOURNAL_MAX_IMAGES, JOURNAL_MAX_TEXT, JOURNAL_SOLUTION_MAX } from "./yStudy";
export type { Column, JournalEntry, JournalKind, StudyState } from "./yStudy";
export type { SiteCard, SiteInfo } from "./sites";
export type { Boss, WaGroup } from "./boss";

/**
 * Nauka żyje w dokumencie Yjs notatek (`yStudy.ts`, instancja w `data.ts`),
 * więc synchronizuje się razem z nimi. Ten moduł to fasada dla widoków /nauka:
 * projekcja przefiltrowana przez materiał (`sanitizeStudy`) i akcje.
 */
// H0.2: kod rozdzielony na projekcję i akcje; ten plik to fasada dla dotychczasowych importów.
export * from "./studyProjection";
export * from "./learnActions";
export * from "./journalActions";
export * from "./siteActions";
