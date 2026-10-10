import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";

/**
 * Jedna notatka jako tekst do schowka. Układ zgodny z `exportToMarkdown`
 * (etykiety, przypomnienie, treść, lista kontrolna), ale bez obrazów —
 * data URL-e zrobiłyby ze schowka megabajty.
 */
export function noteToMarkdown(note: Pick<Note, "title" | "content" | "labels" | "reminder" | "checklist">): string {
  const lines: string[] = [];
  if (note.title.trim()) lines.push(`# ${note.title.trim()}`);
  if (note.labels.length) lines.push(`*Etykiety: ${note.labels.join(", ")}*`);
  if (note.reminder) lines.push(`*Przypomnienie: ${format(new Date(note.reminder), "d MMM yyyy, HH:mm", { locale: pl })}*`);
  if (note.content.trim()) {
    if (lines.length) lines.push("");
    lines.push(note.content.trim());
  }
  if (note.checklist?.length) {
    if (lines.length) lines.push("");
    for (const item of note.checklist) lines.push(`${item.indent ? "  " : ""}- [${item.checked ? "x" : " "}] ${item.text}`);
  }
  return lines.join("\n");
}

/** Bez znaczników Markdown: tytuł, treść, lista z ☐/☑. */
export function noteToPlainText(note: Pick<Note, "title" | "content" | "checklist">): string {
  const blocks: string[] = [];
  if (note.title.trim()) blocks.push(note.title.trim());
  if (note.content.trim()) blocks.push(note.content.trim());
  if (note.checklist?.length) blocks.push(note.checklist.map((i) => `${i.checked ? "☑" : "☐"} ${i.text}`).join("\n"));
  return blocks.join("\n\n");
}

export type CopyFormat = "markdown" | "text";

/** Kopiuje notatkę do schowka i potwierdza toastem. Zwraca, czy się udało. */
export async function copyNoteToClipboard(note: Note, as: CopyFormat = "markdown"): Promise<boolean> {
  const text = as === "markdown" ? noteToMarkdown(note) : noteToPlainText(note);
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Skopiowano");
    return true;
  } catch {
    toast.error("Nie udało się skopiować — schowek jest niedostępny");
    return false;
  }
}
