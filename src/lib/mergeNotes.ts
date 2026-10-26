import type { ChecklistItem, Note } from "@/hooks/useNotes";
import type { Attachment } from "@/lib/attachments";
import { PRIORITY_ORDER, type NotePriority } from "@/lib/notePriority";

/** Oddziela treść kolejnych notatek od treści pierwszej (Markdown: pozioma linia). */
export const MERGE_SEPARATOR = "\n\n---\n\n";

/** Pola, które scalenie zapisuje w notatce docelowej. Tylko te, które faktycznie się zmieniają. */
export type MergePatch = Partial<Pick<Note,
  "title" | "content" | "checklist" | "labels" | "images" | "attachments" | "priority" | "favorite" | "folderId"
  | "reminder" | "reminderRepeat" | "reminderRepeatUntil" | "reminderDay" | "reminderAllDay" | "reminderBase" | "reminderTime"
>>;

export interface MergePlan {
  /** Notatka, w której zostaje wynik (pierwsza na liście). */
  targetId: string;
  patch: MergePatch;
  /** Pozostałe notatki — trafiają do kosza (cofnięcie je przywraca). */
  sourceIds: string[];
}

export type MergeResult = { ok: true; plan: MergePlan } | { ok: false; reason: string };

/** Sekcja treści jednej notatki: tytuł pogrubiony nad treścią (pusty tytuł — sama treść). */
function sectionOf(n: Note): string {
  const title = n.title.trim();
  const body = n.content.trim();
  if (!title) return body;
  return body ? `**${title}**\n\n${body}` : `**${title}**`;
}

function unique<T>(items: readonly T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!seen.has(k)) { seen.add(k); out.push(it); }
  }
  return out;
}

/**
 * Plan scalenia zaznaczonych notatek (kolejność = kolejność na liście, pierwsza zostaje).
 * Czysta funkcja: nie dotyka store'a. `hasChildren` mówi, czy notatka ma podstrony.
 *
 * Odmawia, gdy: mniej niż dwie notatki, którakolwiek jest prywatna (treść zaszyfrowana),
 * tylko do odczytu, w archiwum/koszu albo ma podstrony (kosz zabrałby całą gałąź).
 *
 * Zasady: treść = treść pierwszej + kolejne z tytułem pogrubionym, checklisty i etykiety
 * sumowane, obrazy i załączniki bez powtórzeń, priorytet najwyższy, ulubiona gdy którakolwiek.
 * Termin: zostaje pierwszej, a gdy go nie ma — najwcześniejszy z pozostałych (z serią).
 * Kolor, przypięcie i właściwości (`props`) zostają przy pierwszej notatce.
 */
export function planMerge(notes: readonly Note[], hasChildren: (id: string) => boolean): MergeResult {
  if (notes.length < 2) return { ok: false, reason: "Zaznacz co najmniej dwie notatki." };
  if (notes.some((n) => n.locked)) return { ok: false, reason: "Notatki prywatne nie da się scalić — ich treść jest zaszyfrowana." };
  if (notes.some((n) => n.readOnly)) return { ok: false, reason: "Notatka tylko do odczytu nie może zostać scalona. Odblokuj ją najpierw." };
  if (notes.some((n) => n.archived || n.trashed)) return { ok: false, reason: "Scalać można tylko notatki spoza archiwum i kosza." };
  if (notes.some((n) => hasChildren(n.id))) return { ok: false, reason: "Notatek z podstronami nie da się scalić." };

  const [target, ...rest] = notes;
  const patch: MergePatch = {};

  const title = target.title.trim() ? target.title : (rest.find((n) => n.title.trim())?.title ?? target.title);
  if (title !== target.title) patch.title = title;

  const content = [target.content.trim(), ...rest.map(sectionOf)].filter(Boolean).join(MERGE_SEPARATOR);
  if (content !== target.content) patch.content = content;

  const checklist: ChecklistItem[] = notes.flatMap((n) => n.checklist);
  if (rest.some((n) => n.checklist.length > 0)) patch.checklist = checklist;

  const labels = unique(notes.flatMap((n) => n.labels), (l) => l);
  if (labels.join("\n") !== target.labels.join("\n")) patch.labels = labels;

  const images = unique(notes.flatMap((n) => n.images), (h) => h);
  if (images.join("\n") !== target.images.join("\n")) patch.images = images;

  const attachments: Attachment[] = unique(notes.flatMap((n) => n.attachments ?? []), (a) => a.hash);
  if (attachments.length !== (target.attachments ?? []).length) patch.attachments = attachments;

  const topPriority = notes.map((n) => n.priority ?? "none").reduce<NotePriority>((best, p) => (PRIORITY_ORDER[p] > PRIORITY_ORDER[best] ? p : best), "none");
  if (topPriority !== (target.priority ?? "none")) patch.priority = topPriority;

  if (!target.favorite && rest.some((n) => n.favorite)) patch.favorite = true;

  if (!target.folderId) {
    const folderId = rest.find((n) => n.folderId)?.folderId ?? null;
    if (folderId) patch.folderId = folderId;
  }

  if (target.reminder === null) {
    const withReminder = rest.filter((n) => n.reminder !== null).sort((a, b) => (a.reminder ?? 0) - (b.reminder ?? 0))[0];
    if (withReminder) {
      patch.reminder = withReminder.reminder;
      patch.reminderRepeat = withReminder.reminderRepeat;
      patch.reminderRepeatUntil = withReminder.reminderRepeatUntil;
      patch.reminderDay = withReminder.reminderDay;
      patch.reminderAllDay = withReminder.reminderAllDay;
      patch.reminderBase = withReminder.reminderBase;
      patch.reminderTime = withReminder.reminderTime;
    }
  }

  return { ok: true, plan: { targetId: target.id, patch, sourceIds: rest.map((n) => n.id) } };
}
