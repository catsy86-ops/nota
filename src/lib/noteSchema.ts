import { z } from "zod";
import type { Note, Folder, NoteColor, FolderColor, ChecklistItem } from "@/hooks/useNotes";
import type { NoteVersion } from "@/lib/versionsStore";
import { normalizeAttachments } from "@/lib/attachments";
import { NOTE_COVERS } from "@/lib/noteLook";
import { cleanNoteProps, cleanPropDefs, type PropDef } from "@/lib/noteProps";

import { NOTE_COLORS as COLORS } from "@/lib/safeProjection";

const colorSchema = z.enum(COLORS).catch("default" as NoteColor);
const folderColorSchema = z.enum(COLORS).catch("default" as FolderColor);

const checklistItemSchema = z.object({
  id: z.string().catch(() => crypto.randomUUID()),
  text: z.string().catch(""),
  checked: z.boolean().catch(false),
  indent: z.literal(1).optional().catch(undefined),
}) satisfies z.ZodType<ChecklistItem, z.ZodTypeDef, unknown>;

/** Validates one imported note, filling in safe fallbacks for missing/malformed fields. */
export const noteSchema = z.object({
  id: z.string().catch(() => crypto.randomUUID()),
  title: z.string().catch(""),
  content: z.string().catch(""),
  color: colorSchema,
  pinned: z.boolean().catch(false),
  archived: z.boolean().catch(false),
  trashed: z.boolean().catch(false),
  trashedAt: z.number().nullable().catch(null),
  labels: z.array(z.string()).catch([]),
  aliases: z.array(z.string().max(200)).max(20).optional().catch(undefined),
  reminder: z.number().nullable().catch(null),
  reminderRepeat: z.enum(["none", "daily", "weekly", "monthly"]).optional().catch(undefined),
  reminderDay: z.number().int().min(1).max(31).optional().catch(undefined),
  reminderRepeatUntil: z.number().finite().optional().catch(undefined),
  reminderAllDay: z.boolean().optional().catch(undefined),
  reminderBase: z.number().finite().optional().catch(undefined),
  reminderTime: z.number().int().min(0).max(1439).optional().catch(undefined),
  snoozedUntil: z.number().finite().optional().catch(undefined),
  priority: z.enum(["none", "low", "medium", "high"]).catch("none"),
  dailyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  periodKey: z.string().regex(/^\d{4}-(W\d{2}|\d{2})$/).optional().catch(undefined),
  icon: z.string().min(1).max(32).optional().catch(undefined),
  cover: z.enum(NOTE_COVERS).optional().catch(undefined),
  favorite: z.literal(true).optional().catch(undefined),
  readOnly: z.literal(true).optional().catch(undefined),
  parentId: z.string().min(1).max(200).optional().catch(undefined),
  wide: z.literal(true).optional().catch(undefined),
  largeText: z.literal(true).optional().catch(undefined),
  // Wartości właściwości: zły wpis jest pomijany, notatka zostaje.
  props: z.unknown().transform((v) => cleanNoteProps(v)).optional(),
  images: z.array(z.string()).catch([]),
  // Starsze pliki nie mają pola; zły wpis jest pomijany, nie unieważnia notatki.
  attachments: z.unknown().transform((v) => normalizeAttachments(v)).optional(),
  checklist: z.array(checklistItemSchema).catch([]),
  // Notatka prywatna: tylko szyfrogram (jawne pola są puste). Format sprawdza `yjsStore` przy zapisie.
  locked: z.literal(true).optional().catch(undefined),
  vault: z.string().max(5_000_000).optional().catch(undefined),
  folderId: z.string().nullable().catch(null),
  order: z.number().catch(0),
  createdAt: z.number().catch(() => Date.now()),
  updatedAt: z.number().catch(() => Date.now()),
}) satisfies z.ZodType<Note, z.ZodTypeDef, unknown>;

export const folderSchema = z.object({
  id: z.string().catch(() => crypto.randomUUID()),
  name: z.string().catch(""),
  color: folderColorSchema,
  emoji: z.string().nullable().catch(null),
  parentId: z.string().nullable().catch(null),
  order: z.number().catch(0),
  createdAt: z.number().catch(() => Date.now()),
  updatedAt: z.number().optional().catch(undefined),
}) satisfies z.ZodType<Folder, z.ZodTypeDef, unknown>;

/** Rejects anything that isn't even a plausible array-of-note-like-objects. */
export function looksLikeNoteArray(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every((n) => n && typeof n === "object");
}

/** Liczby pominięte przy eksporcie (nie treść): za duże, nieobecne, zdjęcia dziennika, pliki budów. */
export interface BackupSkipped {
  tooLarge: number;
  missing: number;
  journalPhotos: number;
  siteDocs: number;
  /** Nagrania głosowe z wpisów (U8); starsze kopie tego pola nie mają. */
  recordings?: number;
}

/**
 * Pełny backup. v2 dokłada opcjonalne sekcje — plik v1 (bez nich) czyta się
 * dalej, a przy przywracaniu brakująca sekcja po prostu nie jest ruszana.
 */
export interface FullBackup {
  version: 1 | 2 | 3;
  exportedAt: number;
  notes: Note[];
  labels: string[];
  folders: Folder[];
  /** Historia wersji notatek. */
  versions?: NoteVersion[];
  /** Surowe wartości ustawień z localStorage (tylko klucze z białej listy). */
  settings?: Record<string, string>;
  /** Surowy stan odznak i passy. */
  achievements?: string;
  /** Surowy dokument Grafiku zmian (`lib/shifts`); kształt waliduje `migrate()` przy odczycie. */
  shifts?: string;
  /** Nauka i dziennik z budowy (`lib/study/yStudy.ts`, `StudyDump` jako JSON); kształt waliduje `cleanDump()`. */
  study?: string;
  /** Odżywki i ich dzienne odhaczenia (`lib/supplements/ySupplements.ts`, JSON `{ list, taken }`); kształt waliduje `mergeSupplementDump`. */
  supplements?: string;
  /** Dieta: posiłki i cele (`lib/diet/yDiet.ts`, JSON `{ meals, goals }`); kształt waliduje `mergeDietDump`. */
  diet?: string;
  /** Trening: dziennik serii i plany dni (`lib/training/yTraining.ts`, JSON `{ entries, plans }`); kształt waliduje `mergeTrainingDump`. */
  training?: string;
  /** Długi (lib/debts/yDebts.ts, JSON tablica pożyczek); kształt waliduje cleanDebt przy scalaniu. */
  debts?: string;
  /** Lista przed wejściem na budowę (lib/study/yEntryCheck.ts, JSON); czyszczona przy scalaniu. */
  entryCheck?: string;
  /** Grafiki poza głównym (`lib/shifts/schedules.ts`, JSON tablica `{ id, name, data }`); scalane przy przywracaniu. */
  shiftSchedules?: string;
  /**
   * v3: bajty załączników (hash SHA-256 → data URL), każdy raz. Manifesty są
   * w `notes[].attachments`; plik większy niż budżet backupu jest pominięty —
   * wpis w notatce zostaje, ale bez bajtów.
   */
  attachmentBlobs?: Record<string, string>;
  /** Ile załączników i plików nie weszło do tego pliku — same liczby, pokazuje je okno przywracania. */
  skipped?: BackupSkipped;
  /** Definicje własnych właściwości (`lib/noteProps.ts`); brak sekcji = brak definicji. */
  propDefs?: PropDef[];
  /** Metadane skarbca prywatnych notatek (sól, klucz danych opakowany hasłem) — kształt waliduje `isValidMeta`. */
  vault?: unknown;
}

const versionSchema = z.object({
  id: z.string(),
  noteId: z.string(),
  title: z.string().catch(""),
  content: z.string().catch(""),
  timestamp: z.number(),
});

export const fullBackupSchema = z.object({
  version: z.union([z.literal(1), z.literal(2), z.literal(3)]).catch(1),
  exportedAt: z.number().catch(() => Date.now()),
  notes: z.array(noteSchema).catch([]),
  labels: z.array(z.string()).catch([]),
  folders: z.array(folderSchema).catch([]),
  // Uszkodzona sekcja opcjonalna = brak sekcji, nie odrzucenie całego pliku.
  versions: z.array(versionSchema).optional().catch(undefined),
  settings: z.record(z.string()).optional().catch(undefined),
  achievements: z.string().optional().catch(undefined),
  shifts: z.string().optional().catch(undefined),
  study: z.string().optional().catch(undefined),
  supplements: z.string().optional().catch(undefined),
  diet: z.string().optional().catch(undefined),
  training: z.string().optional().catch(undefined),
  debts: z.string().optional().catch(undefined),
  entryCheck: z.string().optional().catch(undefined),
  shiftSchedules: z.string().optional().catch(undefined),
  attachmentBlobs: z.record(z.string()).optional().catch(undefined),
  skipped: z.object({ tooLarge: z.number(), missing: z.number(), journalPhotos: z.number(), siteDocs: z.number(), recordings: z.number().optional().catch(undefined) }).optional().catch(undefined),
  // Starsze kopie nie mają sekcji — wtedy po prostu brak definicji.
  propDefs: z.unknown().transform((v) => cleanPropDefs(v)).optional(),
  vault: z.unknown().optional(),
}) satisfies z.ZodType<FullBackup, z.ZodTypeDef, unknown>;
