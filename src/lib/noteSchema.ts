import { z } from "zod/mini";
import type { Note, Folder, NoteColor, FolderColor, ChecklistItem } from "@/hooks/useNotes";
import type { NoteVersion } from "@/lib/versionsStore";
import { normalizeAttachments } from "@/lib/attachments";
import { NOTE_COVERS } from "@/lib/noteLook";
import { cleanNoteProps, cleanPropDefs, type PropDef } from "@/lib/noteProps";

import { NOTE_COLORS as COLORS } from "@/lib/safeProjection";

const colorSchema = z.catch(z.enum(COLORS), "default" as NoteColor);
const folderColorSchema = z.catch(z.enum(COLORS), "default" as FolderColor);

const checklistItemSchema = z.object({
  id: z.catch(z.string(), () => crypto.randomUUID()),
  text: z.catch(z.string(), ""),
  checked: z.catch(z.boolean(), false),
  indent: z.catch(z.optional(z.literal(1)), undefined),
}) satisfies z.ZodMiniType<ChecklistItem, unknown>;

/** Reguła powtarzania z nowszych wersji (dni robocze, co 2 tyg., rok, wybrane dni, co N dni) — bez niej kopia i import ją gubiły. */
const repeatRuleSchema = z.object({
  kind: z.enum(["none", "daily", "weekly", "monthly", "workdays", "biweekly", "yearly", "weekdays", "every"]),
  days: z.optional(z.array(z.int().check(z.gte(0), z.lte(6))).check(z.maxLength(7))),
  every: z.optional(z.int().check(z.gte(1), z.lte(365))),
});

/** Validates one imported note, filling in safe fallbacks for missing/malformed fields. */
export const noteSchema = z.object({
  id: z.catch(z.string(), () => crypto.randomUUID()),
  title: z.catch(z.string(), ""),
  content: z.catch(z.string(), ""),
  color: colorSchema,
  pinned: z.catch(z.boolean(), false),
  archived: z.catch(z.boolean(), false),
  trashed: z.catch(z.boolean(), false),
  trashedAt: z.catch(z.nullable(z.number()), null),
  labels: z.catch(z.array(z.string()), []),
  aliases: z.catch(z.optional(z.array(z.string().check(z.maxLength(200))).check(z.maxLength(20))), undefined),
  reminder: z.catch(z.nullable(z.number()), null),
  reminderRepeat: z.catch(z.optional(z.enum(["none", "daily", "weekly", "monthly"])), undefined),
  reminderRule: z.catch(z.optional(repeatRuleSchema), undefined),
  reminderDay: z.catch(z.optional(z.int().check(z.gte(1), z.lte(31))), undefined),
  reminderRepeatUntil: z.catch(z.optional(z.number()), undefined),
  reminderAllDay: z.catch(z.optional(z.boolean()), undefined),
  reminderBase: z.catch(z.optional(z.number()), undefined),
  reminderLead: z.catch(z.optional(z.int().check(z.gte(1), z.lte(10080))), undefined),
  reminderTime: z.catch(z.optional(z.int().check(z.gte(0), z.lte(1439))), undefined),
  snoozedUntil: z.catch(z.optional(z.number()), undefined),
  priority: z.catch(z.enum(["none", "low", "medium", "high"]), "none"),
  dailyDate: z.catch(z.optional(z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/))), undefined),
  periodKey: z.catch(z.optional(z.string().check(z.regex(/^\d{4}-(W\d{2}|\d{2})$/))), undefined),
  icon: z.catch(z.optional(z.string().check(z.minLength(1), z.maxLength(32))), undefined),
  cover: z.catch(z.optional(z.enum(NOTE_COVERS)), undefined),
  favorite: z.catch(z.optional(z.literal(true)), undefined),
  readOnly: z.catch(z.optional(z.literal(true)), undefined),
  parentId: z.catch(z.optional(z.string().check(z.minLength(1), z.maxLength(200))), undefined),
  wide: z.catch(z.optional(z.literal(true)), undefined),
  largeText: z.catch(z.optional(z.literal(true)), undefined),
  // Wartości właściwości: zły wpis jest pomijany, notatka zostaje.
  props: z.optional(z.pipe(z.unknown(), z.transform((v) => cleanNoteProps(v)))),
  images: z.catch(z.array(z.string()), []),
  // Starsze pliki nie mają pola; zły wpis jest pomijany, nie unieważnia notatki.
  attachments: z.optional(z.pipe(z.unknown(), z.transform((v) => normalizeAttachments(v)))),
  checklist: z.catch(z.array(checklistItemSchema), []),
  // Notatka prywatna: tylko szyfrogram (jawne pola są puste). Format sprawdza `yjsStore` przy zapisie.
  locked: z.catch(z.optional(z.literal(true)), undefined),
  vault: z.catch(z.optional(z.string().check(z.maxLength(5_000_000))), undefined),
  folderId: z.catch(z.nullable(z.string()), null),
  order: z.catch(z.number(), 0),
  createdAt: z.catch(z.number(), () => Date.now()),
  updatedAt: z.catch(z.number(), () => Date.now()),
}) satisfies z.ZodMiniType<Note, unknown>;

export const folderSchema = z.object({
  id: z.catch(z.string(), () => crypto.randomUUID()),
  name: z.catch(z.string(), ""),
  color: folderColorSchema,
  emoji: z.catch(z.nullable(z.string()), null),
  parentId: z.catch(z.nullable(z.string()), null),
  order: z.catch(z.number(), 0),
  createdAt: z.catch(z.number(), () => Date.now()),
  updatedAt: z.catch(z.optional(z.number()), undefined),
  templateId: z.catch(z.optional(z.string().check(z.maxLength(100))), undefined),
}) satisfies z.ZodMiniType<Folder, unknown>;

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
  /** Obrazy analiz planów; starsze kopie tego pola nie mają. */
  plans?: number;
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
  /** Masa ciała (C-2, `lib/weight/yWeight.ts`, JSON tablica `{ day, kg, created }`); czyszczona przy scalaniu. */
  weight?: string;
  /** Trening: dziennik serii i plany dni (`lib/training/yTraining.ts`, JSON `{ entries, plans }`); kształt waliduje `mergeTrainingDump`. */
  training?: string;
  /** Długi (lib/debts/yDebts.ts, JSON tablica pożyczek); kształt waliduje cleanDebt przy scalaniu. */
  debts?: string;
  /** Lista przed wejściem na budowę (lib/study/yEntryCheck.ts, JSON); czyszczona przy scalaniu. */
  entryCheck?: string;
  /** Zestawy materiału Pracy (lib/study/yKits.ts, JSON); scalane przy przywracaniu bez nadpisywania (H1.2). */
  kits?: string;
  /** Zapisane widoki (lib/savedViews.ts, JSON tablica); scalane przez `saveView`, który waliduje każdy wpis. */
  views?: string;
  /** Punkty w pomieszczeniach budów (lib/study/yPoints.ts, JSON); scalane bez nadpisywania (H2.1). */
  points?: string;
  /** Sposób rozliczenia budów (lib/study/yBilling.ts, JSON); scalany bez nadpisywania (H3.1). */
  billing?: string;
  /** Zlecenia własne — fuchy (lib/study/yJobs.ts, JSON `{ jobs }`); scalane bez nadpisywania (H3.4). */
  jobs?: string;
  /** Wystawione faktury KSeF (lib/ksef/yInvoices.ts, JSON `{ invoices }`); scalane bez nadpisywania, istniejące są niezmienne (ADR-6). */
  invoices?: string;
  /** Kartoteka klientów (lib/clients/yClients.ts, JSON `{ clients, sites }`); scalana bez nadpisywania. Dane osobowe — tylko w pełnej kopii. */
  clients?: string;
  /** Cenniki: robocizna i ceny kształtek (lib/study/yPricing.ts, JSON `{ labor, materials }`); scalane bez nadpisywania. Starsze kopie mają je wśród ustawień. */
  pricing?: string;
  /** Materiał w aucie (lib/study/yVan.ts, JSON `{ items, events }`); scalany bez nadpisywania (H1.3). */
  van?: string;
  /** Analizy planów (lib/plans/yPlans.ts, JSON `{ entries }`); scalane bez nadpisywania. */
  plans?: string;
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
  title: z.catch(z.string(), ""),
  content: z.catch(z.string(), ""),
  timestamp: z.number(),
});

/** Tablica, w której zły element odpada pojedynczo (a nie unieważnia całości). */
function tolerantArray<T extends z.ZodMiniType>(item: T) {
  return z.pipe(
    z.catch(z.array(z.unknown()), []),
    z.transform((arr) => arr.flatMap((x) => { const r = z.safeParse(item, x); return r.success ? [r.data as z.output<T>] : []; })),
  );
}

export const fullBackupSchema = z.object({
  version: z.catch(z.union([z.literal(1), z.literal(2), z.literal(3)]), 1),
  exportedAt: z.catch(z.number(), () => Date.now()),
  // Element po elemencie: jeden uszkodzony wpis odpada, reszta zostaje. Wcześniej `z.catch` na całej tablicy zerował ją
  // przy pierwszym złym elemencie, a „Przywróć” kasowało wszystkie notatki użytkownika.
  notes: tolerantArray(noteSchema),
  labels: z.catch(z.array(z.string()), []),
  folders: tolerantArray(folderSchema),
  // Uszkodzona sekcja opcjonalna = brak sekcji, nie odrzucenie całego pliku.
  versions: z.catch(z.optional(z.array(versionSchema)), undefined),
  settings: z.catch(z.optional(z.record(z.string(), z.string())), undefined),
  achievements: z.catch(z.optional(z.string()), undefined),
  shifts: z.catch(z.optional(z.string()), undefined),
  study: z.catch(z.optional(z.string()), undefined),
  supplements: z.catch(z.optional(z.string()), undefined),
  diet: z.catch(z.optional(z.string()), undefined),
  training: z.catch(z.optional(z.string()), undefined),
  debts: z.catch(z.optional(z.string()), undefined),
  entryCheck: z.catch(z.optional(z.string()), undefined),
  kits: z.catch(z.optional(z.string()), undefined),
  views: z.catch(z.optional(z.string()), undefined),
  points: z.catch(z.optional(z.string()), undefined),
  plans: z.catch(z.optional(z.string()), undefined),
  billing: z.catch(z.optional(z.string()), undefined),
  jobs: z.catch(z.optional(z.string()), undefined),
  invoices: z.catch(z.optional(z.string()), undefined),
  clients: z.catch(z.optional(z.string()), undefined),
  pricing: z.catch(z.optional(z.string()), undefined),
  van: z.catch(z.optional(z.string()), undefined),
  shiftSchedules: z.catch(z.optional(z.string()), undefined),
  attachmentBlobs: z.catch(z.optional(z.record(z.string(), z.string())), undefined),
  skipped: z.catch(z.optional(z.object({ tooLarge: z.number(), missing: z.number(), journalPhotos: z.number(), siteDocs: z.number(), recordings: z.catch(z.optional(z.number()), undefined), plans: z.catch(z.optional(z.number()), undefined) })), undefined),
  // Starsze kopie nie mają sekcji — wtedy po prostu brak definicji.
  propDefs: z.optional(z.pipe(z.unknown(), z.transform((v) => cleanPropDefs(v)))),
  vault: z.optional(z.unknown()),
}) satisfies z.ZodMiniType<FullBackup, unknown>;
