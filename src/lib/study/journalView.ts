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

const pad = (n: number) => String(n).padStart(2, "0");

/** Moment → wartość `<input type="datetime-local">` w czasie lokalnym („2026-10-14T16:30”). */
export function toLocalInput(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Wartość `datetime-local` → moment; pusta albo niepoprawna → `null`. */
export function fromLocalInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const at = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  return Number.isFinite(at) ? at : null;
}

/** Krótko, kiedy był wpis: „dziś, 14:30”, „wczoraj, 9:05”, „pon., 12 paź, 7:40”. */
export function whenLabel(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86_400_000);
  if (diff === 0) return `dziś, ${time}`;
  if (diff === 1) return `wczoraj, ${time}`;
  const otherYear = d.getFullYear() !== new Date(now).getFullYear();
  const date = d.toLocaleDateString("pl-PL", { weekday: "short", day: "numeric", month: "short", ...(otherYear ? { year: "numeric" } : {}) });
  return `${date}, ${time}`;
}
