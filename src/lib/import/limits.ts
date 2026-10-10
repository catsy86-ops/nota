/** Limity importu — chronią przed zbyt dużymi paczkami i „bombami” ZIP. */
export const IMPORT_LIMITS = {
  /** Plików (po rozpakowaniu ZIP) branych pod uwagę. */
  maxFiles: 3000,
  /** Plik notatki (JSON/HTML/MD). */
  maxNoteFileBytes: 5 * 1024 * 1024,
  /** Obraz załącznika. */
  maxImageBytes: 15 * 1024 * 1024,
  /** Pojedynczy plik ZIP wczytywany do pamięci. */
  maxZipBytes: 300 * 1024 * 1024,
  /** Łącznie po rozpakowaniu. */
  maxTotalBytes: 600 * 1024 * 1024,
  /** Notatek w jednym imporcie. */
  maxNotes: 5000,
  /** Głębokość folderów utworzonych z podkatalogów. */
  maxFolderDepth: 3,
} as const;
