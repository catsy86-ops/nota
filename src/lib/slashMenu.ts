import type { Edit } from "@/lib/editorKeys";

/** Otwarte `/zapytanie` przed karetką: `start` to pozycja ukośnika. */
export interface SlashQuery {
  start: number;
  query: string;
}

export interface SlashCommand {
  id: string;
  label: string;
  /** Krótki opis pod nazwą w liście. */
  hint: string;
  /** Dodatkowe słowa, po których komenda się znajduje (małe litery, bez ogonków). */
  keywords: string[];
  /**
   * `prefix` — znacznik na początku bieżącej linii (zamienia linię w blok);
   * `snippet` — wstawia tekst w miejscu `/zapytania`.
   */
  kind: "prefix" | "snippet";
  insert: string;
  /** Dla `snippet`: ile znaków od końca wstawki ma stanąć karetka (domyślnie 0). */
  caretFromEnd?: number;
}

const MAX_QUERY = 24;

/**
 * `/` na początku linii albo po spacji, a po nim słowo bez spacji — wtedy pokazujemy menu.
 * Ukośnik w środku słowa (`a/b`, `https://…`) nie otwiera menu.
 */
export function slashQueryAt(text: string, caret: number): SlashQuery | null {
  if (caret < 1) return null;
  const start = text.lastIndexOf("/", caret - 1);
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(text[start - 1])) return null;
  const query = text.slice(start + 1, caret);
  if (query.length > MAX_QUERY || /\s/.test(query) || query.includes("/")) return null;
  return { start, query };
}

function localIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function slashCommands(now: Date = new Date()): SlashCommand[] {
  return [
    { id: "h1", label: "Nagłówek 1", hint: "# Duży tytuł sekcji", keywords: ["naglowek", "h1", "tytul"], kind: "prefix", insert: "# " },
    { id: "h2", label: "Nagłówek 2", hint: "## Średni nagłówek", keywords: ["naglowek", "h2"], kind: "prefix", insert: "## " },
    { id: "h3", label: "Nagłówek 3", hint: "### Mały nagłówek", keywords: ["naglowek", "h3"], kind: "prefix", insert: "### " },
    { id: "todo", label: "Zadanie", hint: "Pole do odhaczenia", keywords: ["lista", "checkbox", "todo", "zadania"], kind: "prefix", insert: "- [ ] " },
    { id: "bullet", label: "Lista punktowana", hint: "Wypunktowanie", keywords: ["lista", "punkty", "wypunktowanie"], kind: "prefix", insert: "- " },
    { id: "number", label: "Lista numerowana", hint: "1. 2. 3.", keywords: ["lista", "numery", "kolejnosc"], kind: "prefix", insert: "1. " },
    { id: "quote", label: "Cytat", hint: "Wyróżniony fragment", keywords: ["cytat", "quote", "blockquote"], kind: "prefix", insert: "> " },
    { id: "code", label: "Blok kodu", hint: "Tekst bez formatowania", keywords: ["kod", "code", "programowanie"], kind: "snippet", insert: "```\n\n```", caretFromEnd: 4 },
    { id: "divider", label: "Separator", hint: "Pozioma linia", keywords: ["linia", "podzial", "divider", "hr"], kind: "snippet", insert: "\n---\n" },
    { id: "date", label: "Dzisiejsza data", hint: localIsoDate(now), keywords: ["data", "dzis", "dzisiaj", "today"], kind: "snippet", insert: localIsoDate(now) },
  ];
}

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
}

/** Komendy pasujące do zapytania: najpierw początek nazwy, potem słowa kluczowe, potem fragment. */
export function filterSlashCommands(query: string, commands: SlashCommand[] = slashCommands()): SlashCommand[] {
  const q = fold(query.trim());
  if (!q) return commands;
  const rank = (c: SlashCommand) => {
    const label = fold(c.label);
    if (label.startsWith(q)) return 0;
    if (c.keywords.some((k) => k.startsWith(q))) return 1;
    if (label.includes(q) || c.id.includes(q)) return 2;
    return -1;
  };
  return commands
    .map((c, i) => ({ c, i, r: rank(c) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.c);
}

/** Zamienia `/zapytanie` na wynik komendy; zwraca nowy tekst z karetką. */
export function applySlashCommand(text: string, q: SlashQuery, caret: number, cmd: SlashCommand): Edit {
  const before = text.slice(0, q.start);
  const after = text.slice(caret);

  if (cmd.kind === "prefix") {
    const lineStart = before.lastIndexOf("\n") + 1;
    // `head` to tekst linii sprzed ukośnika (zwykle pusty lub wcięcie) — znacznik idzie przed nim.
    const head = before.slice(lineStart);
    const tail = before.slice(0, lineStart);
    const value = tail + cmd.insert + head + after;
    const pos = tail.length + cmd.insert.length + head.length;
    return { value, selStart: pos, selEnd: pos };
  }

  // Blokowe wstawki (kod, separator) zaczynamy od nowej linii, jeśli karetka nie jest na jej początku.
  const needsBreak = cmd.insert.length > 1 && before.length > 0 && !before.endsWith("\n") && cmd.id !== "date";
  const snippet = needsBreak && !cmd.insert.startsWith("\n") ? `\n${cmd.insert}` : cmd.insert;
  const value = before + snippet + after;
  const end = before.length + snippet.length;
  const pos = end - (cmd.caretFromEnd ?? 0);
  return { value, selStart: pos, selEnd: pos };
}
