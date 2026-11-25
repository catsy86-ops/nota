import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "@/lib/notify";
import type { Note } from "@/lib/types/note";
import { notePath } from "@/lib/viewRoute";

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

/** Link do notatki w składni `[[tytuł]]` (plan Notatek 2.5) — do wklejenia w innej notatce; `null` bez tytułu. */
export const wikiLinkOf = (note: Pick<Note, "title">): string | null => (note.title.trim() ? `[[${note.title.trim()}]]` : null);

/** Q3.7: stały adres notatki (`/notatka/<id>`) — do tagu NFC, skrótu albo zakładki; otwiera ją po wczytaniu. */
export async function copyNoteAddress(id: string, origin: string = location.origin): Promise<boolean> {
  const url = `${origin}${notePath(id)}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Skopiowano adres notatki");
    return true;
  } catch {
    toast.error("Nie udało się skopiować — schowek jest niedostępny");
    return false;
  }
}

/** Kopiuje `[[tytuł]]` notatki do schowka i potwierdza toastem. */
export async function copyWikiLink(note: Pick<Note, "title">): Promise<boolean> {
  const link = wikiLinkOf(note);
  if (!link) { toast.info("Notatka bez tytułu nie ma linku"); return false; }
  try {
    await navigator.clipboard.writeText(link);
    toast.success(`Skopiowano link ${link}`);
    return true;
  } catch {
    toast.error("Nie udało się skopiować — schowek jest niedostępny");
    return false;
  }
}
