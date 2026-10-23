import { splitWikiTarget } from "@/lib/wikiLinks";

/**
 * Osadzanie notatek (`![[notatka]]`, `![[notatka#nagłówek]]`). Czysta logika; renderuje
 * `WikiEmbed`. Notatka osadzona w osadzeniu tworzy zagnieżdżenie, więc głębokość i cykle są
 * ograniczone tutaj, a nie w komponencie.
 */

/** Stan zagnieżdżenia przekazywany rekurencyjnie: poziom i notatki otwarte wyżej (ochrona przed cyklem). */
export interface EmbedContext {
  depth: number;
  chain: string[];
}

/** Najgłębsze zagnieżdżenie: notatka w notatce w notatce. Dalej kafel robi się nieczytelny. */
export const MAX_EMBED_DEPTH = 3;

/** Osadzenie bloku `^id` — obsługa przychodzi z odnośnikami do bloków (Faza 3.4). */
export function isBlockEmbed(heading: string | null): boolean {
  return heading !== null && heading.startsWith("^");
}

/** Treść sekcji o podanym nagłówku: od tego nagłówka do następnego o tym samym lub wyższym poziomie. */
export function extractSection(content: string, heading: string): string | null {
  const wanted = heading.trim().toLowerCase();
  const lines = content.split("\n");
  const start = lines.findIndex((line) => {
    const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    return !!m && m[2].trim().toLowerCase() === wanted;
  });
  if (start < 0) return null;
  const level = /^(#{1,6})/.exec(lines[start])![1].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(#{1,6})\s/.exec(lines[i]);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n").trimEnd();
}

/** Część osadzenia: `![[Tytuł#Nagłówek]]` → cel i nagłówek (bez wykrzyknika). */
export function splitEmbedTarget(raw: string): { title: string; heading: string | null } {
  const { title, heading } = splitWikiTarget(raw);
  return { title, heading };
}
