import { isOverdueOccurrence } from "@/lib/dueTerms";
import type { Occurrence } from "@/lib/reminderOccurrences";

export type DotKind = "overdue" | "saved" | "forecast";

/** Jedna kropka w wąskiej komórce dnia: jedna notatka, niezależnie od liczby jej wystąpień tego dnia. */
export interface DayDot {
  noteId: string;
  kind: DotKind;
  /** Ile wystąpień tej notatki przypada na ten dzień (seria co godzinę = kilka). */
  count: number;
}

const RANK: Record<DotKind, number> = { overdue: 0, saved: 1, forecast: 2 };

function kindOf(occ: Occurrence, now: number): DotKind {
  if (occ.isSeries && !occ.isNext) return "forecast";
  return isOverdueOccurrence(occ, now) ? "overdue" : "saved";
}

/**
 * Kropki wąskiej komórki dnia w Kalendarzu. Wcześniej każde wystąpienie miało własną kropkę, więc
 * seria powtarzana kilka razy dziennie dawała rząd pustych kręgów („0000 +3”). Teraz jedna kropka
 * na notatkę, o najważniejszym rodzaju (zaległy > zapisany > prognoza). „+N” liczy kolejne notatki.
 */
export function dayDots(occurrences: readonly Occurrence[], max: number, now = Date.now()): { dots: DayDot[]; hidden: number } {
  const byNote = new Map<string, DayDot>();
  for (const occ of occurrences) {
    const kind = kindOf(occ, now);
    const cur = byNote.get(occ.noteId);
    if (!cur) byNote.set(occ.noteId, { noteId: occ.noteId, kind, count: 1 });
    else {
      cur.count++;
      if (RANK[kind] < RANK[cur.kind]) cur.kind = kind;
    }
  }
  const all = [...byNote.values()];
  return { dots: all.slice(0, max), hidden: Math.max(0, all.length - max) };
}
