/**
 * Parser zapytania wyszukiwarki — czysty, bez zależności od React ani Fuse.
 *
 * Operatory (wielkość liter i polskie znaki nie mają znaczenia):
 *   etykieta:x  label:x       folder:x        color:x
 *   ma:przypomnienie  ma:obraz  ma:lista     (has:reminder / image / checklist)
 *   brak:przypomnienia
 *   przypięte
 *   lista:otwarte             (checklista z nieodhaczoną pozycją)
 *   starsze:30d  nowsze:7d    (d = dni, t = tygodnie, m = miesiące; sama liczba = dni)
 * Wartość ze spacją w cudzysłowie: etykieta:"moja praca". Wiele operatorów = AND.
 * Nieznany operator i wszystko inne to zwykły tekst dla Fuse.
 */

export type Clause =
  | { type: "label"; value: string }
  | { type: "folder"; value: string }
  | { type: "color"; value: string }
  | { type: "reminder" }
  | { type: "noReminder" }
  | { type: "image" }
  | { type: "checklist" }
  | { type: "pinned" }
  | { type: "openList" }
  | { type: "older"; days: number }
  | { type: "newer"; days: number };

export interface ParsedQuery {
  clauses: Clause[];
  /** Reszta zapytania — idzie do Fuse. */
  text: string;
}

/** Małe litery bez ogonków — porównania operatorów i wartości. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").toLowerCase();
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
    case "folder":
      return { type: "folder", value };
    case "color": case "kolor":
      return { type: "color", value };
    case "ma": case "has":
      if (["przypomnienie", "przypomnienia", "reminder"].includes(v)) return { type: "reminder" };
      if (["obraz", "obrazy", "obrazek", "zdjecie", "zdjecia", "image", "images"].includes(v)) return { type: "image" };
      if (["lista", "checklista", "checklist"].includes(v)) return { type: "checklist" };
      return null;
    case "brak":
      if (["przypomnienia", "przypomnienie", "reminder"].includes(v)) return { type: "noReminder" };
      return null;
    case "lista":
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
    const m = tok.match(/^([^:"\s]+):(.+)$/);
    if (m) {
      const clause = clauseFor(fold(m[1]), m[2]);
      if (clause) { clauses.push(clause); continue; }
    } else if (["przypiete", "przypiety", "przypieta", "pinned"].includes(fold(tok))) {
      clauses.push({ type: "pinned" });
      continue;
    }
    free.push(unquote(tok));
  }
  return { clauses, text: free.filter(Boolean).join(" ") };
}

export interface MatchNote {
  labels: string[];
  color: string;
  folderId: string | null;
  reminder: number | null;
  images?: string[];
  checklist?: { checked: boolean }[];
  pinned: boolean;
  updatedAt: number;
}
export interface MatchFolder { id: string; name: string; parentId?: string | null }
export interface MatchContext { folders?: MatchFolder[]; now?: number }

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

export function matchesClauses(note: MatchNote, clauses: Clause[], ctx: MatchContext = {}): boolean {
  const now = ctx.now ?? Date.now();
  return clauses.every((c) => {
    switch (c.type) {
      case "label": { const v = fold(c.value); return note.labels.some((l) => fold(l) === v); }
      case "folder": return !!note.folderId && folderIdsByName(c.value, ctx.folders ?? []).has(note.folderId);
      case "color": return fold(note.color) === fold(c.value);
      case "reminder": return !!note.reminder;
      case "noReminder": return !note.reminder;
      case "image": return (note.images ?? []).length > 0;
      case "checklist": return (note.checklist ?? []).length > 0;
      case "pinned": return note.pinned;
      case "openList": return (note.checklist ?? []).some((i) => !i.checked);
      case "older": return note.updatedAt < now - c.days * DAY_MS;
      case "newer": return note.updatedAt >= now - c.days * DAY_MS;
    }
  });
}
