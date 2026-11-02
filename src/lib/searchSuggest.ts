import { fold } from "@/lib/searchQuery";

export interface Suggestion {
  /** Tekst na liście. */
  label: string;
  /** Co wstawić w miejsce ostatniego tokenu (przy `recent` — całe zapytanie). */
  insert: string;
  /** Krótki opis po polsku obok operatora („z przypomnieniem”). */
  hint?: string;
  /** `recent` — ostatnie wyszukiwanie (zastępuje całe pole), `clear` — „Wyczyść ostatnie”. */
  kind?: "operator" | "value" | "recent" | "clear";
}

export interface SuggestContext {
  labels: string[];
  folders: string[];
}

const OPERATORS: Suggestion[] = [
  { label: "etykieta:", insert: "etykieta:", hint: "z etykietą…" },
  { label: "folder:", insert: "folder:", hint: "w folderze (z podfolderami)" },
  { label: "ścieżka:", insert: "ścieżka:", hint: "w dokładnie tym folderze" },
  { label: "ma:przypomnienie", insert: "ma:przypomnienie ", hint: "z przypomnieniem" },
  { label: "ma:obraz", insert: "ma:obraz ", hint: "ze zdjęciem lub obrazem" },
  { label: "ma:lista", insert: "ma:lista ", hint: "z listą zadań" },
  { label: "ma:zalacznik", insert: "ma:zalacznik ", hint: "z załącznikiem" },
  { label: "ma:prywatne", insert: "ma:prywatne ", hint: "notatki ze skarbca" },
  { label: "brak:przypomnienia", insert: "brak:przypomnienia ", hint: "bez przypomnienia" },
  { label: "brak:etykiety", insert: "brak:etykiety ", hint: "bez etykiety" },
  { label: "brak:folderu", insert: "brak:folderu ", hint: "poza folderami" },
  { label: "priorytet:wysoki", insert: "priorytet:wysoki ", hint: "ważne" },
  { label: "przypięte", insert: "przypięte ", hint: "przypięte na górze" },
  { label: "lista:otwarte", insert: "lista:otwarte ", hint: "z nieodhaczonym zadaniem" },
  { label: "starsze:30d", insert: "starsze:30d ", hint: "nieruszane od 30 dni" },
  { label: "nowsze:7d", insert: "nowsze:7d ", hint: "zmienione w tym tygodniu" },
].map((o) => ({ ...o, kind: "operator" as const }));

/** Szybkie filtry w pustym polu — najczęstsze pytania „co mam…”. */
const QUICK = ["ma:przypomnienie", "lista:otwarte", "przypięte", "nowsze:7d"];

/**
 * Pole puste i w fokusie: ostatnie wyszukiwania (zastępują całe pole), szybkie filtry z opisem i — gdy są
 * ostatnie — „Wyczyść ostatnie wyszukiwania”.
 */
export function emptySuggestions(recent: readonly string[]): Suggestion[] {
  const items: Suggestion[] = recent.map((q) => ({ label: q, insert: q, hint: "ostatnio", kind: "recent" }));
  items.push(...OPERATORS.filter((o) => QUICK.includes(o.label)));
  if (recent.length) items.push({ label: "Wyczyść ostatnie wyszukiwania", insert: "", kind: "clear" });
  return items;
}

const quoteIfNeeded = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

/** Indeks początku ostatniego tokenu (z uwzględnieniem cudzysłowów). */
function lastTokenStart(q: string): number {
  let start = 0;
  let inQuote = false;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (ch === '"') inQuote = !inQuote;
    else if (/\s/.test(ch) && !inQuote) start = i + 1;
  }
  return start;
}

/**
 * Podpowiedzi dla ostatniego, jeszcze niedokończonego tokenu zapytania.
 * `etykieta:` / `folder:` → istniejące nazwy; początek operatora → operatory.
 */
export function suggestOperators(query: string, ctx: SuggestContext, limit = 8): { from: number; items: Suggestion[] } {
  const from = lastTokenStart(query);
  const token = query.slice(from);
  if (!token) return { from, items: [] };

  const m = token.match(/^([^:"\s]+):(.*)$/);
  if (m) {
    const key = fold(m[1]);
    const source = key === "etykieta" || key === "label" ? ctx.labels : key === "folder" ? ctx.folders : null;
    // Inny operator („ma:p”, „brak:”) — dalej pasujące operatory, a nie pusta lista po dwukropku.
    if (!source) {
      const typedOp = fold(token);
      return { from, items: OPERATORS.filter((o) => fold(o.label).startsWith(typedOp) && fold(o.label) !== typedOp).slice(0, limit) };
    }
    const typed = fold(m[2].replace(/"/g, ""));
    const items = source
      .filter((name) => fold(name).includes(typed) && fold(name) !== typed)
      .slice(0, limit)
      .map((name) => ({ label: name, insert: `${m[1]}:${quoteIfNeeded(name)} `, hint: source === ctx.labels ? "etykieta" : "folder", kind: "value" as const }));
    return { from, items };
  }

  const typed = fold(token);
  const items = OPERATORS.filter((o) => fold(o.label).startsWith(typed) && fold(o.label) !== typed).slice(0, limit);
  return { from, items };
}

/** Wstawia podpowiedź w miejsce ostatniego tokenu. */
export function applySuggestion(query: string, from: number, s: Suggestion): string {
  return query.slice(0, from) + s.insert;
}
