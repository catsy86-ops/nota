import type { NotePriority } from "@/lib/notePriority";
import type { ReminderRepeat, RepeatRule } from "@/lib/reminderRepeat";

/**
 * Typy wspólne dla pola nowej notatki, Skrzynki i czytnika (plan architektury A1.5). Hooki biorą je stąd,
 * a nie z komponentów, które je renderują. Komponenty je reeksportują, więc dawne importy działają.
 */

/** Od czego zaczyna się nowa notatka (długie przytrzymanie „+” na telefonie). */
export type ComposerAction = "note" | "list" | "dictate" | "image" | "draw" | "reminder";

/** Pola, których nie niesie lista pozycyjna `onAdd` — seria przypomnienia i rodzic. */
export interface ComposerExtras {
  reminderAllDay?: boolean;
  reminderLead?: number;
  reminderRepeat?: ReminderRepeat;
  reminderRule?: RepeatRule;
  reminderRepeatUntil?: number;
  parentId?: string;
}

/** Dodatki z pola Skrzynki: etykiety, folder, priorytet, termin. */
export interface InboxCaptureExtras {
  labels: string[];
  /** Podzbiór `labels` do utworzenia. */
  newLabels: string[];
  folderId: string | null;
  priority: NotePriority | null;
  reminder: number | null;
}

/** Tryb czytnika notatki. */
export type ReaderMode = "preview" | "present";
