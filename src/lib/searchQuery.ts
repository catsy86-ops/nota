import { propDisplayText, propValueFor, type NoteProps, type PropDef } from "@/lib/noteProps";
import { extractWikiLinks } from "@/lib/wikiLinks";

/**
 * Parser zapytania wyszukiwarki — czysty, bez zależności od React ani silnika tekstowego.
 *
 * Operatory (wielkość liter i polskie znaki nie mają znaczenia):
 *   etykieta:x  label:x       folder:x        color:x
 *   alias:x                   (notatka ma alias x)
 *   link:x                    (notatka linkuje [[x]] — do „x” prowadzi wikilink)
 *   zadanie:otwarte           (to samo co lista:otwarte)
 *   ma:przypomnienie  ma:obraz  ma:lista     (has:reminder / image / checklist)
 *   brak:przypomnienia
 *   przypięte
 *   lista:otwarte             (checklista z nieodhaczoną pozycją)
 *   starsze:30d  nowsze:7d    (d = dni, t = tygodnie, m = miesiące; sama liczba = dni)
 *   priorytet:wysoki|sredni|niski   ma:zalacznik   brak:etykiety  brak:folderu
 *   pole:Nazwa=wartość        (własne pole notatki; bez „=” = pole ma jakąkolwiek wartość;
 *                             wartość ze spacją: pole:"Status=w toku")
 *   pole:Nazwa>5  <  >=  <=   (porównanie: liczby numerycznie, daty i tekst leksykalnie)
 *   ścieżka:Praca/Budowa      (folder o dokładnie tej ścieżce; bez podfolderów — w odróżnieniu od folder:)
 *   -operator:wartość         (negacja, np. -etykieta:praca)
 * Wartość ze spacją w cudzysłowie: etykieta:"moja praca". Wiele operatorów = AND.
 * Nieznany operator i wszystko inne to zwykły tekst dla silnika tekstowego.
 */

export type Clause =
  | { type: "label"; value: string }
  | { type: "alias"; value: string }
  | { type: "link"; value: string }
  | { type: "folder"; value: string }
  | { type: "color"; value: string }
  | { type: "reminder" }
  | { type: "noReminder" }
  | { type: "image" }
  | { type: "checklist" }
  | { type: "pinned" }
  | { type: "openList" }
  | { type: "older"; days: number }
  | { type: "newer"; days: number }
  | { type: "priority"; value: "low" | "medium" | "high" }
  | { type: "attachment" }
  | { type: "noLabel" }
  | { type: "noFolder" }
  | { type: "prop"; name: string; value?: string }
  | { type: "propCompare"; name: string; op: CompareOp; value: string }
  | { type: "path"; value: string }
  | { type: "not"; clause: Clause };

export type CompareOp = ">" | "<" | ">=" | "<=";

export interface ParsedQuery {
  clauses: Clause[];
  /** Reszta zapytania — idzie do silnika tekstowego (`searchNotes`). */
  text: string;
}

/** Małe litery bez ogonków — porównania operatorów i wartości. */
export function fold(s: string): string {
  // Najpierw małe litery, potem „ł” — inaczej wielkie „Ł” zostawało bez zmiany i nie trafiało w „lodz”.
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/ł/g, "l");
}

/** Dzieli po spacjach, ale spacje w cudzysłowie zostają w tokenie. */
export function tokenize(q: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of q) {
    if (ch === '"') { inQuote = !inQuote; cur += ch; continue; }
    if (/\s/.test(ch) && !inQuote) {
      if (cur) out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const unquote = (s: string) => s.replace(/"/g, "").trim();

function parseDays(v: string): number | null {
  const m = fold(v).match(/^(\d{1,4})([dtwm]?)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult = m[2] === "t" || m[2] === "w" ? 7 : m[2] === "m" ? 30 : 1;
  return n * mult;
}

function clauseFor(key: string, rawValue: string): Clause | null {
  const value = unquote(rawValue);
  const v = fold(value);
  if (!v) return null;
  switch (key) {
    case "etykieta": case "label":
      return { type: "label", value };
    case "alias":
      return { type: "alias", value };
    case "link": case "odnosnik":
      return { type: "link", value };
    case "folder":
      return { type: "folder", value };
    case "sciezka": case "path":
      return { type: "path", value };
    case "color": case "kolor":
      return { type: "color", value };
    case "ma": case "has":
      if (["przypomnienie", "przypomnienia", "reminder"].includes(v)) return { type: "reminder" };
      if (["obraz", "obrazy", "obrazek", "zdjecie", "zdjecia", "image", "images"].includes(v)) return { type: "image" };
      if (["lista", "checklista", "checklist"].includes(v)) return { type: "checklist" };
      if (["zalacznik", "zalaczniki", "plik", "pliki", "attachment", "attachments"].includes(v)) return { type: "attachment" };
      return null;
    case "brak":
      if (["przypomnienia", "przypomnienie", "reminder"].includes(v)) return { type: "noReminder" };
      if (["etykiety", "etykieta", "label", "labels"].includes(v)) return { type: "noLabel" };
      if (["folderu", "folder"].includes(v)) return { type: "noFolder" };
      return null;
    case "priorytet": case "priority": {
      const map: Record<string, "low" | "medium" | "high"> = { niski: "low", low: "low", sredni: "medium", medium: "medium", wysoki: "high", high: "high" };
      return map[v] ? { type: "priority", value: map[v] } : null;
    }
    case "pole": case "field": {
      // Porównanie: `Nazwa>5`, `Nazwa>=5` itd. — operator zaraz po nazwie.
      const cmp = value.match(/^([^=<>]*)(>=|<=|>|<)(.*)$/);
      if (cmp) {
        const name = cmp[1].trim();
        const want = cmp[3].trim();
        if (!name || !want) return null;
        return { type: "propCompare", name, op: cmp[2] as CompareOp, value: want };
      }
      // Nazwa pola i wartość rozdziela pierwszy „=”; nazwa dopasowywana bez wielkości liter i ogonków.
      const eq = value.indexOf("=");
      const name = (eq < 0 ? value : value.slice(0, eq)).trim();
      if (!name) return null;
      const want = eq < 0 ? "" : value.slice(eq + 1).trim();
      return { type: "prop", name, value: want || undefined };
    }
    case "lista": case "zadanie": case "task":
      if (["otwarte", "otwarta", "open"].includes(v)) return { type: "openList" };
      return null;
    case "starsze": case "older": {
      const days = parseDays(value);
      return days === null ? null : { type: "older", days };
    }
    case "nowsze": case "newer": {
      const days = parseDays(value);
      return days === null ? null : { type: "newer", days };
    }
    default:
      return null;
  }
}

export function parseSearchQuery(query: string): ParsedQuery {
  const clauses: Clause[] = [];
  const free: string[] = [];
  for (const tok of tokenize(query.trim())) {
    const m = tok.match(/^(-?)([^:"\s]+):(.+)$/);
    if (m) {
      const clause = clauseFor(fold(m[2]), m[3]);
      if (clause) { clauses.push(m[1] ? { type: "not", clause } : clause); continue; }
    } else if (["przypiete", "przypiety", "przypieta", "pinned"].includes(fold(tok))) {
      clauses.push({ type: "pinned" });
      continue;
    }
    free.push(unquote(tok));
  }
  return { clauses, text: free.filter(Boolean).join(" ") };
}

/**
 * Słowa warte podświetlenia w treści (czytnik): wolny tekst zapytania bez
 * operatorów — także polskich (`etykieta:`, `folder:`, `ma:`, `przypięte`).
 */
export function highlightTokens(query: string | undefined): string[] {
  const q = (query || "").trim();
  if (!q) return [];
  return parseSearchQuery(q).text.split(/\s+/).filter((t) => t.length >= 2);
}

export interface MatchNote {
  labels: string[];
  /** Potrzebne operatorom `alias:` i `link:`. */
  aliases?: string[];
  content?: string;
  color: string;
  folderId: string | null;
  reminder: number | null;
  images?: string[];
  checklist?: { checked: boolean }[];
  attachments?: unknown[];
  priority?: string;
  pinned: boolean;
  updatedAt: number;
  props?: NoteProps;
}
export interface MatchFolder { id: string; name: string; parentId?: string | null }
export interface MatchContext { folders?: MatchFolder[]; now?: number; propDefs?: PropDef[] }

const DAY_MS = 86_400_000;

/** Id folderów o danej nazwie razem z podfolderami. */
function folderIdsByName(name: string, folders: MatchFolder[]): Set<string> {
  const target = fold(name);
  const ids = new Set(folders.filter((f) => fold(f.name) === target).map((f) => f.id));
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) { ids.add(f.id); grew = true; }
    }
  }
  return ids;
}

/** `pole:Nazwa` (wartość jest) albo `pole:Nazwa=wartość` (ta sama treść jak w komórce; przecinek = kropka). */
function matchesProp(note: MatchNote, name: string, want: string | undefined, defs: PropDef[]): boolean {
  const def = defs.find((d) => fold(d.name) === fold(name));
  if (!def) return false;
  const text = propDisplayText(def, propValueFor(def, note.props));
  if (text === "") return false;
  if (want === undefined) return true;
  const norm = (s: string) => fold(s).replace(/\./g, ",");
  return norm(text) === norm(want);
}

/** `pole:Nazwa>x`: liczba liczy się numerycznie (przecinek = kropka), reszta leksykalnie po `fold` (daty ISO też). */
function matchesPropCompare(note: MatchNote, name: string, op: CompareOp, want: string, defs: PropDef[]): boolean {
  const def = defs.find((d) => fold(d.name) === fold(name));
  if (!def) return false;
  const raw = propValueFor(def, note.props);
  if (raw === undefined || raw === "") return false;
  let order: number;
  if (def.type === "number") {
    const x = Number(raw);
    const y = Number(want.replace(",", "."));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    order = x - y;
  } else {
    const x = fold(String(raw));
    const y = fold(want);
    order = x < y ? -1 : x > y ? 1 : 0;
  }
  switch (op) {
    case ">": return order > 0;
    case "<": return order < 0;
    case ">=": return order >= 0;
    case "<=": return order <= 0;
  }
}

/** Ścieżka folderu od korzenia, np. „praca/budowa” (małe litery bez ogonków). */
function folderPathOf(id: string, folders: MatchFolder[]): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let cur = folders.find((f) => f.id === id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    names.unshift(fold(cur.name));
    const parentId: string | null | undefined = cur.parentId;
    cur = parentId ? folders.find((f) => f.id === parentId) : undefined;
  }
  return names.join("/");
}

/** Ścieżka z zapytania w tej samej postaci co `folderPathOf`: `Praca / Budowa` → `praca/budowa`. */
function normalizePath(value: string): string {
  return value.split("/").map((s) => fold(s.trim())).filter(Boolean).join("/");
}

export function matchesClauses(note: MatchNote, clauses: Clause[], ctx: MatchContext = {}): boolean {
  const now = ctx.now ?? Date.now();
  return clauses.every(function test(c: Clause): boolean {
    switch (c.type) {
      case "not": return !test(c.clause);
      case "priority": return (note.priority ?? "none") === c.value;
      case "attachment": return (note.attachments ?? []).length > 0;
      case "noLabel": return note.labels.length === 0;
      case "noFolder": return !note.folderId;
      case "label": { const v = fold(c.value); return note.labels.some((l) => fold(l) === v); }
      case "alias": { const v = fold(c.value); return (note.aliases ?? []).some((a) => fold(a) === v); }
      case "link": { const v = fold(c.value); return extractWikiLinks(note.content ?? "").some((t) => fold(t) === v); }
      case "folder": return !!note.folderId && folderIdsByName(c.value, ctx.folders ?? []).has(note.folderId);
      case "color": return fold(note.color) === fold(c.value);
      case "reminder": return !!note.reminder;
      case "noReminder": return !note.reminder;
      case "image": return (note.images ?? []).length > 0;
      case "checklist": return (note.checklist ?? []).length > 0;
      case "pinned": return note.pinned;
      case "openList": return (note.checklist ?? []).some((i) => !i.checked);
      case "prop": return matchesProp(note, c.name, c.value, ctx.propDefs ?? []);
      case "propCompare": return matchesPropCompare(note, c.name, c.op, c.value, ctx.propDefs ?? []);
      case "path": {
        if (!note.folderId) return false;
        const want = normalizePath(c.value);
        return !!want && folderPathOf(note.folderId, ctx.folders ?? []) === want;
      }
      case "older": return note.updatedAt < now - c.days * DAY_MS;
      case "newer": return note.updatedAt >= now - c.days * DAY_MS;
    }
  });
}
