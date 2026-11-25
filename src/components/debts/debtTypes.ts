import { formatAmount, type DebtKind } from "@/lib/debts/model";

/** Typy i pomocnicze terminy zwrotu wspólne dla formularzy Długów (L1.1: wydzielone z `DebtsView.tsx`). */

/**
 * Przypomnienia notatek powiązanych z długiem (1.1, D-4). `clear` zdejmuje termin i zwraca poprzedni
 * (albo `null`, gdy go nie było); `restore` oddaje termin, gdy użytkownik cofnie.
 */
export interface DebtReminderApi {
  clear: (noteId: string) => number | null;
  restore: (noteId: string, at: number) => void;
  /** Bieżący termin notatki (1.5: edycja terminu zwrotu); `null` = bez terminu albo notatki nie ma. */
  get: (noteId: string) => number | null;
  /** Czy notatka jeszcze istnieje (także w archiwum i koszu) — usunięta nie przyjmie nowego terminu. */
  has: (noteId: string) => boolean;
  /** Usuwa notatkę utworzoną przez edycję, gdy użytkownik ją cofnie (bez osieroconych notatek). */
  remove: (noteId: string) => void;
}

/** Notatka z przypomnieniem (`Index`); `labels` — etykiety notatki (1.2: `długi`, poza Skrzynką). */
export type AddReminderNote = (title: string, content: string, at: number, labels: string[]) => string;

/** Tytuł notatki terminu; przy ukrytych kwotach bez kwoty (1.2) — tytuł widać w powiadomieniu i na Dziś. */
export const dueTitle = (kind: DebtKind, person: string, amount: number, hidden: boolean) =>
  `${kind === "lent" ? "Zwrot od" : "Oddać"} ${person}${hidden ? "" : `: ${formatAmount(amount)}`}`;

/** Termin zwrotu: dzień o 9:00 (ms). */
export const dueAt = (day: string) => new Date(`${day}T09:00:00`).getTime();

export const hasDue = (kind: DebtKind) => kind === "lent" || kind === "borrowed";
