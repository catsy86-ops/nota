import type { NoteColor } from "@/hooks/useNotes";

/** Plik wejściowy importu — z wybranych plików, folderu albo z wnętrza archiwum ZIP. */
export interface SourceFile {
  /** Ścieżka względna z separatorem „/” (bez wiodącego „/”). */
  path: string;
  /** Sama nazwa pliku. */
  name: string;
  size: number;
  lastModified: number;
  bytes(): Promise<Uint8Array>;
  text(): Promise<string>;
}

export interface AttachmentRef {
  /** Nazwa/ścieżka pliku wskazana przez źródło (Keep: `filePath`, HTML: `src`). */
  filePath: string;
  mimeType: string;
}

/** Notatka po sparsowaniu — jeszcze bez id, folderu i obrazów w magazynie. */
export interface ParsedNote {
  origin: "keep" | "markdown";
  /** Ścieżka pliku źródłowego (do raportu). */
  source: string;
  title: string;
  content: string;
  checklist: { text: string; checked: boolean }[];
  labels: string[];
  color: NoteColor;
  pinned: boolean;
  /** Ikona notatki (emoji) z frontmattera `icon:`. */
  icon?: string;
  /** Ulubiona (frontmatter `favorite: true`). */
  favorite?: boolean;
  archived: boolean;
  trashed: boolean;
  /** `null` = źródło nie podało czasu (wtedy używamy daty pliku/„teraz”). */
  createdAt: number | null;
  updatedAt: number | null;
  /** Kolejne foldery (z podkatalogów Markdown); puste = bez folderu. */
  folderPath: string[];
  attachments: AttachmentRef[];
}
