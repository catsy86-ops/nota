import { z } from "zod";
import type { Note, Folder, NoteColor, FolderColor, ChecklistItem } from "@/hooks/useNotes";

const COLORS = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"] as const;

const colorSchema = z.enum(COLORS).catch("default" as NoteColor);
const folderColorSchema = z.enum(COLORS).catch("default" as FolderColor);

const checklistItemSchema = z.object({
  id: z.string().catch(() => crypto.randomUUID()),
  text: z.string().catch(""),
  checked: z.boolean().catch(false),
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
  reminder: z.number().nullable().catch(null),
  reminderRepeat: z.enum(["none", "daily", "weekly", "monthly"]).optional().catch(undefined),
  priority: z.enum(["none", "low", "medium", "high"]).catch("none"),
  images: z.array(z.string()).catch([]),
  checklist: z.array(checklistItemSchema).catch([]),
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

export interface FullBackup {
  version: 1;
  exportedAt: number;
  notes: Note[];
  labels: string[];
  folders: Folder[];
}

export const fullBackupSchema = z.object({
  version: z.literal(1).catch(1),
  exportedAt: z.number().catch(() => Date.now()),
  notes: z.array(noteSchema).catch([]),
  labels: z.array(z.string()).catch([]),
  folders: z.array(folderSchema).catch([]),
}) satisfies z.ZodType<FullBackup, z.ZodTypeDef, unknown>;
