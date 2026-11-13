import { LanguageDescription } from "@codemirror/language";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import { CODE_LANGUAGES } from "@/lib/codeLanguages";

/** Fragment kodu z klasą `tok-*` (albo bez, gdy to zwykły tekst między tokenami). */
export interface CodeSpan {
  text: string;
  cls: string | null;
}

/** Dłuższe bloki zostają zwykłym tekstem: parsowanie i tysiące `<span>` w czytniku nie są warte kolorów. */
export const HIGHLIGHT_MAX_CHARS = 20_000;

/** Czy język z linii otwierającej blok (` ```ts `) jest na liście. */
export function knownCodeLanguage(name: string): boolean {
  return LanguageDescription.matchLanguageName(CODE_LANGUAGES, name.trim(), true) !== null;
}

/**
 * Podział kodu na fragmenty z klasami `tok-*` (`classHighlighter` z Lezer — ta sama gramatyka co w edytorze).
 * `null` — nieznany język albo zbyt długi blok; wywołujący pokazuje zwykły tekst.
 */
export async function highlightCode(code: string, languageName: string): Promise<CodeSpan[] | null> {
  if (code.length > HIGHLIGHT_MAX_CHARS) return null;
  const desc = LanguageDescription.matchLanguageName(CODE_LANGUAGES, languageName.trim(), true);
  if (!desc) return null;
  const support = await desc.load();
  const tree = support.language.parser.parse(code);
  const spans: CodeSpan[] = [];
  let pos = 0;
  highlightTree(tree, classHighlighter, (from, to, cls) => {
    if (from > pos) spans.push({ text: code.slice(pos, from), cls: null });
    spans.push({ text: code.slice(from, to), cls });
    pos = to;
  });
  if (pos < code.length) spans.push({ text: code.slice(pos), cls: null });
  return spans;
}
