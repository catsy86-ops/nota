import type { Note } from "@/hooks/useNotes";
import { comparePropsForSort, type PropDef } from "@/lib/noteProps";
import { fold, parseSearchQuery, tokenize } from "@/lib/searchQuery";
import { searchNotes, type SearchContext } from "@/lib/searchNotes";

/**
 * Osadzony widok w notatce (plan Notatek 6.4): blok
 *
 *     ```zapytanie
 *     etykieta:budowa pole:Status=Nowe sortuj:-termin kolumny:Status,Klient limit:20
 *     ```
 *
 * pokazuje tabelę notatek pasujących do zapytania. Zapytanie to ta sama składnia co w wyszukiwarce
 * (`parseSearchQuery`); dochodzą trzy operatory bloku: `sortuj:`, `kolumny:` i `limit:`. Moduł jest czysty
 * (bez Reacta), więc ten sam wynik trafia do czytnika i do podglądu w edytorze.
 */

export const QUERY_BLOCK_LANGUAGES = ["zapytanie", "query"] as const;

export const QUERY_BLOCK_LIMITS = { defaultRows: 25, maxRows: 100, defaultColumns: 3 } as const;

export interface QueryBlockSpec {
  /** Zapytanie bez operatorów bloku — idzie do `searchNotes`. */
  query: string;
  /** Klucz sortowania z pliku (tytuł, zmiana, utworzono, termin albo nazwa pola); `null` = domyślnie. */
  sortKey: string | null;
  dir: 1 | -1;
  /** Nazwy pól do pokazania; `null` = pierwsze pola notatek. */
  columns: string[] | null;
  limit: number;
}

function unquote(s: string): string {
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

export function isQueryBlockLanguage(lang: string | undefined): boolean {
  return !!lang && (QUERY_BLOCK_LANGUAGES as readonly string[]).includes(lang.trim().toLowerCase());
}

/** Rozbiera treść bloku na zapytanie i ustawienia widoku. Błędne wartości (np. `limit:abc`) są pomijane. */
export function parseQueryBlock(source: string): QueryBlockSpec {
  const rest: string[] = [];
  const spec: QueryBlockSpec = { query: "", sortKey: null, dir: 1, columns: null, limit: QUERY_BLOCK_LIMITS.defaultRows };
  for (const tok of tokenize(source.replace(/\n/g, " ").trim())) {
    const m = /^([^:"\s]+):(.+)$/.exec(tok);
    const key = m ? fold(m[1]) : "";
    if (m && (key === "sortuj" || key === "sort")) {
      let v = unquote(m[2]).trim();
      if (v.startsWith("-")) { spec.dir = -1; v = v.slice(1); }
      if (v) spec.sortKey = v;
    } else if (m && (key === "kolumny" || key === "columns")) {
      const cols = unquote(m[2]).split(",").map((c) => c.trim()).filter(Boolean);
      if (cols.length) spec.columns = cols;
    } else if (m && key === "limit") {
      const n = Number(m[2]);
      if (Number.isInteger(n) && n > 0) spec.limit = Math.min(n, QUERY_BLOCK_LIMITS.maxRows);
    } else {
      rest.push(tok);
    }
  }
  spec.query = rest.join(" ");
  return spec;
}

export interface QueryBlockResult {
  rows: Note[];
  /** Ile notatek pasuje do zapytania (przed `limit:`). */
  total: number;
  columns: PropDef[];
  /** Nazwy z `kolumny:`, których nie ma wśród pól. */
  unknownColumns: string[];
  /** Nazwa z `sortuj:`, której nie rozpoznano (wtedy sortowanie domyślne). */
  unknownSort: string | null;
}

const SORT_ALIASES: Record<string, "title" | "updated" | "created" | "reminder"> = {
  tytul: "title", title: "title",
  zmiana: "updated", zmieniono: "updated", updated: "updated",
  utworzono: "created", utworzenie: "created", created: "created",
  termin: "reminder", przypomnienie: "reminder", reminder: "reminder",
};

function sortRows(rows: Note[], spec: QueryBlockSpec, defs: PropDef[], hasText: boolean): { rows: Note[]; unknownSort: string | null } {
  if (spec.sortKey === null) {
    // Bez `sortuj:` kolejność trafności zostaje tylko przy szukaniu tekstu; inaczej najnowsze zmiany na górze.
    return { rows: hasText ? rows : [...rows].sort((a, b) => b.updatedAt - a.updatedAt), unknownSort: null };
  }
  const key = fold(spec.sortKey);
  const alias = SORT_ALIASES[key];
  const dir = spec.dir;
  if (alias === "title") return { rows: [...rows].sort((a, b) => a.title.localeCompare(b.title, "pl", { numeric: true, sensitivity: "base" }) * dir), unknownSort: null };
  if (alias === "updated") return { rows: [...rows].sort((a, b) => (a.updatedAt - b.updatedAt) * dir), unknownSort: null };
  if (alias === "created") return { rows: [...rows].sort((a, b) => (a.createdAt - b.createdAt) * dir), unknownSort: null };
  if (alias === "reminder") {
    // Notatki bez terminu zawsze na końcu, jak puste pola.
    return {
      rows: [...rows].sort((a, b) => (a.reminder === null || b.reminder === null ? (a.reminder === b.reminder ? 0 : a.reminder === null ? 1 : -1) : (a.reminder - b.reminder) * dir)),
      unknownSort: null,
    };
  }
  const def = defs.find((d) => fold(d.name) === key);
  if (def) return { rows: [...rows].sort((a, b) => comparePropsForSort(def, a.props, b.props, dir, a, b)), unknownSort: null };
  return { rows: hasText ? rows : [...rows].sort((a, b) => b.updatedAt - a.updatedAt), unknownSort: spec.sortKey };
}

/**
 * Wykonuje blok na liście notatek. Prywatne (zablokowane) notatki nigdy nie trafiają do wyniku — ich treść i pola są
 * zaszyfrowane, a blok mógłby je ujawnić w cudzej notatce.
 */
export function runQueryBlock(spec: QueryBlockSpec, notes: Note[], ctx: SearchContext & { propDefs?: PropDef[] } = {}): QueryBlockResult {
  const defs = [...(ctx.propDefs ?? [])].sort((a, b) => a.order - b.order);
  const visible = notes.filter((n) => !n.locked && !n.trashed && !n.archived);
  const matched = spec.query.trim() ? searchNotes(visible, spec.query, ctx) : visible;
  const hasText = parseSearchQuery(spec.query).text.trim() !== "";
  const { rows, unknownSort } = sortRows(matched, spec, defs, hasText);

  let columns: PropDef[];
  const unknownColumns: string[] = [];
  if (spec.columns) {
    columns = [];
    for (const name of spec.columns) {
      const def = defs.find((d) => fold(d.name) === fold(name));
      if (def) { if (!columns.includes(def)) columns.push(def); } else unknownColumns.push(name);
    }
  } else {
    columns = defs.slice(0, QUERY_BLOCK_LIMITS.defaultColumns);
  }
  return { rows: rows.slice(0, spec.limit), total: rows.length, columns, unknownColumns, unknownSort };
}

/**
 * Dane dla podglądu w edytorze (CodeMirror nie ma Reacta ani kontekstu notatek). `NotesProvider` odświeża je przy
 * każdej zmianie; `version` rośnie, żeby widżet wiedział, że wynik jest nieaktualny.
 */
export interface QueryBlockData {
  notes: Note[];
  folders: SearchContext["folders"];
  propDefs: PropDef[];
}

let data: QueryBlockData = { notes: [], folders: [], propDefs: [] };
let dataVersion = 0;

export function setQueryBlockData(next: QueryBlockData): void {
  if (next.notes === data.notes && next.folders === data.folders && next.propDefs === data.propDefs) return;
  data = next;
  dataVersion++;
}

export function getQueryBlockData(): { data: QueryBlockData; version: number } {
  return { data, version: dataVersion };
}
