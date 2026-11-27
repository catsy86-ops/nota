import { parsePastedUrl } from "@/lib/urlTitle";

/**
 * Schowek z sensem (Q3.6): czyste decyzje bez DOM, wspólne dla kompozytora (`AddNoteBar`), edytora CodeMirror
 * (`CmEditor`) i arkuszy ze zdjęciami. Listy z punktorami do listy zadań rozpoznaje `checklistPaste.ts`.
 */

/**
 * Adres wklejony na zaznaczony tekst: `[zaznaczenie](adres)`. `null`, gdy wklejany tekst to nie sam adres http(s),
 * zaznaczenia nie ma, obejmuje kilka linii albo samo jest adresem (wtedy zwykłe wklejenie podmienia adres).
 */
export function linkOverSelection(pasted: string, selected: string): string | null {
  const parsed = parsePastedUrl(pasted);
  if (!parsed || !selected.trim() || /[\r\n]/.test(selected) || parsePastedUrl(selected)) return null;
  // Nawiasy w tekście linku i w adresie łamałyby składnię Markdown.
  const label = selected.replace(/([[\]\\])/g, "\\$1");
  const url = parsed.url.replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `[${label}](${url})`;
}

/** Obrazy ze schowka (zrzut ekranu, skopiowane zdjęcie). */
export function pastedImageFiles(data: Pick<DataTransfer, "files"> | null | undefined): File[] {
  return Array.from(data?.files ?? []).filter((f) => f.type.startsWith("image/"));
}
