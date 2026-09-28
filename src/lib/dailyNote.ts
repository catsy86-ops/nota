import type { Note } from "@/hooks/useNotes";

/**
 * Notatka dnia: jedna notatka na lokalną datę, rozpoznawana po polu
 * `dailyDate`, nie po tytule — tytuł można zmienić, a po tytule dopasowują
 * się też wikilinki, więc duplikaty tytułów psułyby jedno i drugie.
 */

export const DAILY_LABEL = "dziennik";

export const DAILY_TEMPLATE =
  "**3 rzeczy, za które jestem wdzięczny:**\n1. \n2. \n3. \n\n**Co dziś osiągnąłem:**\n\n**Co jutro:**";

const pad = (n: number) => String(n).padStart(2, "0");

/** Lokalna data `YYYY-MM-DD` — o północy zaczyna się nowa notatka dnia. */
export function dailyKey(now: number = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dailyTitle(now: number = Date.now()): string {
  return new Date(now).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Notatka dnia dla danej daty. Kosz się nie liczy (wtedy powstaje nowa),
 * Archiwum tak — to nadal ta sama notatka. Gdy dwa urządzenia offline
 * utworzyły ją niezależnie, wygrywa starsza, więc wszystkie urządzenia
 * po synchronizacji wskazują tę samą.
 */
export function findDailyNote(notes: Note[], key: string): Note | undefined {
  let best: Note | undefined;
  for (const n of notes) {
    if (n.dailyDate !== key || n.trashed) continue;
    if (!best || n.createdAt < best.createdAt || (n.createdAt === best.createdAt && n.id < best.id)) best = n;
  }
  return best;
}

/**
 * Dopisuje znacznik godziny na końcu treści, żeby kolejny wpis w ciągu dnia
 * miał swoje miejsce. Ponowne otwarcie w tej samej minucie nie dubluje znacznika.
 */
export function appendTimestamp(content: string, now: number = Date.now()): string {
  const d = new Date(now);
  const stamp = `**${pad(d.getHours())}:${pad(d.getMinutes())}**`;
  const trimmed = content.trimEnd();
  if (trimmed.endsWith(stamp)) return content;
  return trimmed ? `${trimmed}\n\n${stamp} ` : `${stamp} `;
}
