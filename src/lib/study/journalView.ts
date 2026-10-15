import { pluralPl } from "@/lib/plural";
import type { JournalKind } from "./yStudy";

export const KIND_LABEL: Record<JournalKind, string> = { ok: "Zrobione", problem: "Problem", note: "Notatka" };

/** Rok tylko wtedy, gdy inny niż bieżący — inaczej wpisy sprzed roku zlewały się z dzisiejszymi. */
export function dayLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const otherYear = d.getFullYear() !== new Date(now).getFullYear();
  return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", ...(otherYear ? { year: "numeric" } : {}) });
}

export const entriesPl = (n: number) => `${n} ${pluralPl(n, ["wpis", "wpisy", "wpisów"])}`;
export const problemsPl = (n: number) => `${n} ${pluralPl(n, ["problem", "problemy", "problemów"])}`;
