import type { Fitting } from "./fittings";
import type { JournalKind } from "./yStudy";
import { fold, parseSpokenFittings, QTY_WORD, SINGULAR, TENS, UNITS } from "./spokenFittings";

/**
 * Cały wpis z jednej wypowiedzi: „Lipowa, problem, przeciek przy trójniku, kolano 16 cztery sztuki”
 * → budowa „Lipowa 5”, rodzaj „Problem”, tekst „przeciek przy trójniku”, kształtka Kolano 16 × 4.
 *
 * Rozpoznawanie mowy zwykle nie stawia przecinków, więc reguły są ostrożne — co nie pasuje, zostaje
 * tekstem dokładnie tak, jak padło:
 * - budowa tylko na początku: pełna nazwa znanej budowy („lipowa pięć”) albo jej pierwsze słowo,
 *   jeśli jest jednoznaczne i stoi za nim przecinek albo słowo rodzaju („lipowa problem …”);
 *   opcjonalnie poprzedzona słowem „budowa”;
 * - rodzaj tylko jako pierwsze słowo po budowie: problem/usterka/awaria, notatka/uwaga, zrobione/gotowe;
 * - kształtka: nazwa kształtki (albo znana nazwa wielowyrazowa) i za nią co najmniej jedna liczba;
 *   „trójniki rozsunięte trzydzieści centymetrów” to tekst, „trójnik 16 dwa” — kształtka.
 * Czysta funkcja, testy w `spokenEntry.test.ts`.
 */

export interface SpokenEntry {
  /** Nazwa znanej budowy, jak w karcie; brak = nie padła. */
  site?: string;
  kind?: JournalKind;
  fittings: Fitting[];
  /** Tekst wpisu bez rozpoznanych części; bez struktury — cała wypowiedź bez zmian. */
  text: string;
  /** Rozpoznano budowę, rodzaj albo kształtki. */
  structured: boolean;
}

const KIND_MARKERS = new Map<string, JournalKind>([
  ["problem", "problem"], ["usterka", "problem"], ["awaria", "problem"],
  ["notatka", "note"], ["uwaga", "note"],
  ["zrobione", "ok"], ["zrobiony", "ok"], ["gotowe", "ok"], ["skonczone", "ok"],
]);

const FITTING_WORDS = new Set<string>([...Object.keys(SINGULAR), ...Object.values(SINGULAR).map(fold)]);
const NUM_WORDS = new Map<string, string>(
  [...Object.entries(UNITS), ...Object.entries(TENS)].map(([w, n]) => [fold(w), String(n)] as const),
);
const CONJ = new Set(["i", "oraz", "plus", "a"]);
const LEAD_WORDS = new Set(["ksztaltki", "ksztaltek", "material"]);

const isSep = (t: string) => /^[,;.:!?]$/.test(t);
const norm = (t: string) => { const f = fold(t); return NUM_WORDS.get(f) ?? f; };
const isNumeric = (t: string) => /^\d+(?:[/.,]\d+)?$/.test(t) || NUM_WORDS.has(fold(t));

/** Słowa nazwy przed pierwszą liczbą („Kolano naścienne 16” → kolano, nascienne). */
const namePrefix = (name: string) => {
  const out: string[] = [];
  for (const w of fold(name).split(/\s+/)) { if (/\d/.test(w)) break; out.push(w); }
  return out;
};

function matchSite(tokens: string[], at: number, sites: readonly string[]): { name: string; len: number } | null {
  const words = tokens.slice(at).map(norm);
  // Pełna nazwa — najdłuższa wygrywa („Dom Kowalski 2” przed „Dom Kowalski”).
  const full = sites
    .map((name) => ({ name, parts: fold(name).split(/\s+/).filter(Boolean) }))
    .filter((s) => s.parts.length > 0 && s.parts.every((p, i) => words[i] === p))
    .sort((a, b) => b.parts.length - a.parts.length)[0];
  if (full) return { name: full.name, len: full.parts.length };
  // Samo pierwsze słowo: jednoznaczne i zaraz za nim przecinek, słowo rodzaju albo koniec wypowiedzi.
  const first = words[0];
  if (!first || first.length < 3) return null;
  const same = sites.filter((n) => fold(n).split(/\s+/)[0] === first);
  if (same.length !== 1) return null;
  const after = tokens[at + 1];
  if (after !== undefined && !isSep(after) && !KIND_MARKERS.has(fold(after))) return null;
  return { name: same[0], len: 1 };
}

export function parseSpokenEntry(
  spoken: string,
  { sites = [], fittings: knownFittings = [] }: { sites?: readonly string[]; fittings?: readonly string[] } = {},
): SpokenEntry {
  const raw = spoken.trim();
  // Interpunkcja jako osobne słowa — ale nie kropka w „1.5” ani ukośnik w „20/16”.
  const tokens = raw.replace(/([,;.:!?])(?=\s|$)/g, " $1").split(/\s+/).filter(Boolean);
  let i = 0;
  const skipSeps = () => { while (i < tokens.length && isSep(tokens[i])) i++; };

  let site: string | undefined;
  skipSeps();
  const withWord = i < tokens.length && fold(tokens[i]) === "budowa";
  const m = matchSite(tokens, withWord ? i + 1 : i, sites);
  if (m) { site = m.name; i += m.len + (withWord ? 1 : 0); skipSeps(); }

  let kind: JournalKind | undefined;
  const marker = i < tokens.length ? KIND_MARKERS.get(fold(tokens[i])) : undefined;
  if (marker) { kind = marker; i++; skipSeps(); }

  const phrases = [...new Set(knownFittings.map((n) => namePrefix(n).join(" ")))]
    .map((p) => p.split(" "))
    .filter((p) => p.length > 1)
    .sort((a, b) => b.length - a.length);
  const fittingStart = (rest: string[], j: number): number => {
    for (const p of phrases) if (p.every((w, k) => rest[j + k] !== undefined && fold(rest[j + k]) === w)) return p.length;
    return FITTING_WORDS.has(fold(rest[j])) ? 1 : 0;
  };

  const rest = tokens.slice(i);
  const text: string[] = [];
  const spans: string[] = [];
  for (let j = 0; j < rest.length;) {
    const start = fittingStart(rest, j);
    if (start > 0) {
      let k = j + start;
      let nums = 0;
      while (k < rest.length) {
        const t = rest[k];
        const f = fold(t);
        if (isNumeric(t)) { nums++; k++; continue; }
        if (f === "na" && nums > 0 && k + 1 < rest.length && isNumeric(rest[k + 1])) { k++; continue; }
        if (f === "x" || f === "razy") { k++; continue; }
        if (QTY_WORD.test(f)) { k++; break; }
        break;
      }
      if (nums > 0) {
        // „…, i kształtki: kolano 16” — spójnik, przecinek i słowo-zapowiedź przed kształtką nie zostają w tekście.
        while (text.length > 0 && (isSep(text[text.length - 1]) || CONJ.has(fold(text[text.length - 1])) || LEAD_WORDS.has(fold(text[text.length - 1])))) text.pop();
        spans.push(rest.slice(j, k).join(" "));
        j = k;
        continue;
      }
    }
    text.push(rest[j]);
    j++;
  }

  const fittings = spans.length > 0 ? parseSpokenFittings(spans.join(", "), knownFittings) : [];
  const structured = site !== undefined || kind !== undefined || fittings.length > 0;
  if (!structured) return { fittings: [], text: raw, structured: false };

  while (text.length > 0 && (isSep(text[0]) || CONJ.has(fold(text[0])))) text.shift();
  while (text.length > 0 && (isSep(text[text.length - 1]) || CONJ.has(fold(text[text.length - 1])))) text.pop();
  const joined = text.join(" ").replace(/\s+([,;.:!?])/g, "$1");
  return { ...(site ? { site } : {}), ...(kind ? { kind } : {}), fittings, text: joined, structured };
}
