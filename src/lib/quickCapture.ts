import type { NotePriority } from "./notePriority";
import { parseNaturalDate } from "./parseNaturalDate";

/**
 * Szybkie wprowadzanie: rozpoznaje w tekście nowej notatki tokeny
 * `#etykieta`, `@folder`, `!` / `!!` oraz datę na końcu („jutro 9:00”).
 * Moduł jest czysty — nic nie zapisuje; wynik pokazujemy jako chipy
 * i dopiero zaakceptowane tokeny są wycinane z tekstu.
 */

export type CaptureField = "title" | "content";

interface TokenBase {
  field: CaptureField;
  /** Zakres w tekście pola (włącznie ze znakiem `#` / `@`). */
  start: number;
  end: number;
  /** Dosłowny tekst tokenu. */
  raw: string;
  /** Stabilny klucz do listy zignorowanych (nie zależy od pozycji). */
  key: string;
}

export type CaptureToken =
  | (TokenBase & { kind: "label"; label: string; isNew: boolean })
  | (TokenBase & { kind: "folder"; folderId: string; name: string })
  | (TokenBase & { kind: "priority"; priority: NotePriority })
  | (TokenBase & { kind: "date"; date: Date });

export interface CaptureContext {
  labels: string[];
  folders: { id: string; name: string }[];
  now?: Date;
  /** Przypomnienie ustawione już ręcznie — fraza daty nie jest wtedy rozpoznawana. */
  hasReminder?: boolean;
  /** Priorytet ustawiony już ręcznie — `!` zostaje w tekście. */
  hasPriority?: boolean;
}

/** `!` = średni, `!!` = wysoki. */
export const PRIORITY_BY_BANGS: Record<number, NotePriority> = { 1: "medium", 2: "high" };

const WORD_CHAR = /[\p{L}\p{N}_-]/u;

function isBoundaryBefore(text: string, i: number): boolean {
  return i === 0 || /\s/.test(text[i - 1]);
}

function isBoundaryAfter(text: string, i: number): boolean {
  return i >= text.length || !WORD_CHAR.test(text[i]);
}

/** Zakresy kodu w grawisach — tokeny w środku są ignorowane. */
function codeRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(/```[\s\S]*?```|`[^`\n]+`/g)) out.push([m.index!, m.index! + m[0].length]);
  return out;
}

function inRanges(i: number, ranges: [number, number][]): boolean {
  return ranges.some(([a, b]) => i >= a && i < b);
}

/** Małe litery bez zmiany długości tekstu (potrzebne do dopasowania pozycji). */
function fold(s: string): string {
  let out = "";
  for (const ch of s) {
    const l = ch.toLowerCase();
    out += l.length === ch.length ? l : ch;
  }
  return out;
}

/** Najdłuższa nazwa z listy pasująca tuż za `#` / `@` (bez rozróżniania wielkości liter). */
function matchName<T>(text: string, from: number, items: T[], nameOf: (t: T) => string): { item: T; end: number } | null {
  const sorted = [...items].sort((a, b) => nameOf(b).length - nameOf(a).length);
  const rest = fold(text.slice(from));
  for (const item of sorted) {
    const name = nameOf(item);
    if (!name.trim()) continue;
    if (rest.startsWith(fold(name)) && isBoundaryAfter(text, from + name.length)) return { item, end: from + name.length };
  }
  return null;
}

/** Bez polskich znaków i małymi literami, zachowuje długość tekstu. */
function plain(s: string): string {
  let out = "";
  for (const ch of s) {
    const mapped = ch === "ł" || ch === "Ł" ? "l" : ch.normalize("NFD")[0];
    out += mapped.toLowerCase();
  }
  return out;
}

const DAY_WORD = "(?:dzis|dzisiaj|jutro|pojutrze|niedziel[ae]|poniedzialek|wtorek|sroda|srode|czwartek|piatek|sobota|sobote)";
const DATE_END_RE = new RegExp(
  `(?:^|\\s)(za\\s+\\d+\\s*(?:godz(?:in[aey]?)?|h|min(?:ut[aey]?)?|m|dni|dzien)|${DAY_WORD}(?:\\s+\\d{1,2}[:.]\\d{2})?|\\d{1,2}:\\d{2})$`,
);

/** Przyimek tuż przed frazą daty („Lista na sobotę”): to część zdania w tytule, a nie termin. */
const PREPOSITION_BEFORE_RE = /(?:^|\s)(?:na|do|we?|od|o|dla|przed|po)\s*$/;

/** Rozpoznaje tokeny w jednym polu. Pozycje odnoszą się do `text`. */
function scanField(text: string, field: CaptureField, ctx: CaptureContext): CaptureToken[] {
  const out: CaptureToken[] = [];
  const code = codeRanges(text);
  const now = ctx.now ?? new Date();

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if ((ch === "#" || ch === "@") && isBoundaryBefore(text, i) && !inRanges(i, code)) {
      const from = i + 1;
      if (ch === "#") {
        const known = matchName(text, from, ctx.labels, (l) => l);
        if (known) {
          out.push({ kind: "label", field, start: i, end: known.end, raw: text.slice(i, known.end), label: known.item, isNew: false, key: `label:${fold(known.item)}` });
          i = known.end;
          continue;
        }
        let j = from;
        while (j < text.length && WORD_CHAR.test(text[j])) j++;
        // Końcowe myślniki / podkreślenia („#praca--”) nie są częścią nazwy.
        const word = text.slice(from, j).replace(/[-_]+$/, "");
        // `#1` to numer, a `#` ze spacją (nagłówek Markdown) w ogóle nie ma słowa.
        if (word && !/^\d+$/.test(word)) {
          const end = from + word.length;
          out.push({ kind: "label", field, start: i, end, raw: text.slice(i, end), label: word, isNew: true, key: `label:${fold(word)}` });
          i = end;
          continue;
        }
      } else {
        const hit = matchName(text, from, ctx.folders, (f) => f.name);
        if (hit) {
          out.push({ kind: "folder", field, start: i, end: hit.end, raw: text.slice(i, hit.end), folderId: hit.item.id, name: hit.item.name, key: `folder:${hit.item.id}` });
          i = hit.end;
          continue;
        }
      }
    }
    i++;
  }

  // Priorytet: samodzielne `!` / `!!` albo `!!` doklejone na samym końcu pola.
  // Pojedynczy `!` przy słowie to zwykły wykrzyknik.
  if (!ctx.hasPriority) {
    for (const m of text.matchAll(/(?:^|\s)(!{1,2})(?=\s|$)/g)) {
      const start = m.index! + m[0].length - m[1].length;
      if (inRanges(start, code)) continue;
      out.push({ kind: "priority", field, start, end: start + m[1].length, raw: m[1], priority: PRIORITY_BY_BANGS[m[1].length], key: `priority:${m[1].length}` });
    }
    const glued = /[^\s!]!!$/.exec(text);
    if (glued && !inRanges(glued.index, code)) {
      out.push({ kind: "priority", field, start: text.length - 2, end: text.length, raw: "!!", priority: "high", key: "priority:2" });
    }
  }

  // Data na końcu pola: wąska gramatyka, a samą wartość liczy parseNaturalDate.
  if (!ctx.hasReminder) {
    const trimmedEnd = text.replace(/\s+$/, "").length;
    const head = text.slice(0, trimmedEnd);
    const m = DATE_END_RE.exec(plain(head));
    if (m) {
      const start = trimmedEnd - m[1].length;
      const raw = head.slice(start);
      const date = parseNaturalDate(raw, now);
      // W tytule przyimek przed datą zostawia frazę w tekście („na sobotę” nie ustawia przypomnienia).
      const afterPreposition = field === "title" && PREPOSITION_BEFORE_RE.test(plain(head.slice(0, start)));
      if (date && !inRanges(start, code) && !afterPreposition) {
        out.push({ kind: "date", field, start, end: trimmedEnd, raw, date, key: `date:${plain(raw)}` });
      }
    }
  }

  return out.sort((a, b) => a.start - b.start);
}

export interface CaptureInput {
  title: string;
  content: string;
}

/**
 * Wszystkie rozpoznane tokeny (bez filtrowania zignorowanych). Kolizje:
 * pierwszy `@folder`, pierwszy priorytet i pierwsza data wygrywają, kolejne
 * zostają w tekście jako zwykły tekst. Tytuł jest skanowany przed treścią.
 */
export function extractCapture(input: CaptureInput, ctx: CaptureContext): CaptureToken[] {
  const all = [...scanField(input.title, "title", ctx), ...scanField(input.content, "content", ctx)];
  const taken = new Set<string>();
  return all.filter((t) => {
    if (t.kind === "label") return true;
    if (taken.has(t.kind)) return false;
    taken.add(t.kind);
    return true;
  });
}

export interface CaptureResult {
  title: string;
  content: string;
  /** Etykiety do dodania (istniejące w kanonicznej pisowni, bez duplikatów). */
  labels: string[];
  /** Podzbiór `labels`, który trzeba dopiero utworzyć. */
  newLabels: string[];
  folderId: string | null;
  priority: NotePriority | null;
  reminder: Date | null;
}

function removeRanges(text: string, ranges: [number, number][]): string {
  if (ranges.length === 0) return text;
  let out = "";
  let pos = 0;
  for (const [a, b] of [...ranges].sort((x, y) => x[0] - y[0])) {
    out += text.slice(pos, a);
    // „zrób to #praca, potem” → „zrób to, potem”: interpunkcja przykleja się do słowa.
    if (/^[,.;:!?)]/.test(text.slice(b, b + 1))) out = out.replace(/[ \t]+$/, "");
    pos = Math.max(pos, b);
  }
  out += text.slice(pos);
  // Po wycięciu zlewa podwójne spacje w środku linii, układ linii zostaje.
  return out
    .split("\n")
    .map((line) => line.replace(/(\S)[ \t]{2,}(?=\S)/g, "$1 ").replace(/[ \t]+$/, ""))
    .join("\n");
}

/** Stosuje przyjęte tokeny (te, których klucza nie ma w `ignored`). */
export function applyCapture(
  input: CaptureInput,
  tokens: CaptureToken[],
  ignored: ReadonlySet<string> = new Set(),
  /** Obrazki / lista zadań: notatka nie jest pusta, więc fraza daty może zniknąć z tekstu. */
  hasOtherContent = false,
): CaptureResult {
  const active = tokens.filter((t) => !ignored.has(t.key));
  const cut: Record<CaptureField, [number, number][]> = { title: [], content: [] };
  const labels: string[] = [];
  const newLabels: string[] = [];
  let folderId: string | null = null;
  let priority: NotePriority | null = null;
  let reminder: Date | null = null;

  for (const t of active) {
    cut[t.field].push([t.start, t.end]);
    if (t.kind === "label") {
      if (!labels.some((l) => fold(l) === fold(t.label))) {
        labels.push(t.label);
        if (t.isNew) newLabels.push(t.label);
      }
    } else if (t.kind === "folder") folderId = t.folderId;
    else if (t.kind === "priority") priority = t.priority;
    else reminder = t.date;
  }

  let title = removeRanges(input.title, cut.title).trim();
  let content = removeRanges(input.content, cut.content).trim();
  // Notatka złożona wyłącznie z frazy daty („jutro 9:00”) nie może zniknąć: tekst zostaje, przypomnienie się ustawia.
  if (!title && !content && !hasOtherContent && (input.title.trim() || input.content.trim())) {
    for (const f of ["title", "content"] as const) {
      cut[f] = active.filter((t) => t.field === f && t.kind !== "date").map((t): [number, number] => [t.start, t.end]);
    }
    title = removeRanges(input.title, cut.title).trim();
    content = removeRanges(input.content, cut.content).trim();
  }

  return {
    title,
    content,
    labels,
    newLabels,
    folderId,
    priority,
    reminder,
  };
}

/** Tekst chipa i etykieta dla czytników ekranu. */
export function describeToken(t: CaptureToken, formatDate: (d: Date) => string): { label: string; aria: string } {
  switch (t.kind) {
    case "label": return { label: `#${t.label}`, aria: `${t.isNew ? "Nowa etykieta" : "Etykieta"} ${t.label}` };
    case "folder": return { label: `Folder: ${t.name}`, aria: `Folder ${t.name}` };
    case "priority": {
      const name = t.priority === "high" ? "wysoki" : t.priority === "medium" ? "średni" : "niski";
      return { label: `Priorytet: ${name}`, aria: `Priorytet ${name}` };
    }
    case "date": return { label: `Przypomnienie: ${formatDate(t.date)}`, aria: `Przypomnienie ${formatDate(t.date)}` };
  }
}
