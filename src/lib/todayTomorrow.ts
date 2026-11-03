import { dayType, type DayEntry, type ShiftType } from "@/lib/shifts/model";
import { pluralPl } from "@/lib/plural";

/**
 * Dziś 2.2: wieczorem podgląd jutra na karcie zmiany — „Jutro: R 06:00–14:00 · 2 terminy”.
 * Godzina startu to godzina wieczornego przypomnienia o Grafiku (`readEveningNudgeTime`), a bez niego 18:00.
 */
export const TOMORROW_DEFAULT_FROM = "18:00";

/** Czy już pora na podgląd jutra (od `from`, „HH:mm”, do północy). */
export function isTomorrowPreviewTime(now: Date, from: string | null): boolean {
  const [h, m] = (from ?? TOMORROW_DEFAULT_FROM).split(":").map(Number);
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}

/** Terminy na dzień zaczynający się o `dayStart` (bez kosza). Seria liczy się po swoim najbliższym terminie. */
export function countRemindersOn(notes: readonly { reminder: number | null; trashed?: boolean }[], dayStart: Date): number {
  const start = new Date(dayStart); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return notes.filter((n) => !n.trashed && n.reminder !== null && n.reminder >= start.getTime() && n.reminder < end.getTime()).length;
}

/** Tekst wiersza. Zmiana: skrót z godzinami albo nazwa nieobecności; bez wpisu w Grafiku — „wolne”. */
export function tomorrowLine(entry: DayEntry | undefined, types: readonly ShiftType[], terms: number): string {
  const type = entry ? types.find((t) => t.id === entry.type) : undefined;
  let shift = "wolne";
  if (type) {
    const t = dayType(type, entry);
    shift = t.kind === "absence" ? t.name : `${t.short} ${t.start}–${t.end}`;
  }
  const parts = [shift];
  if (terms > 0) parts.push(`${terms} ${pluralPl(terms, ["termin", "terminy", "terminów"])}`);
  return `Jutro: ${parts.join(" · ")}`;
}
