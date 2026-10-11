import type { ParsedNote } from "./types";

export type FrontmatterValue = string | string[];

/**
 * Frontmatter YAML — wąski podzbiór wystarczający dla Obsidiana i typowych
 * eksportów: `klucz: wartość`, `klucz: [a, b]`, lista `- a` pod kluczem,
 * wartości w cudzysłowach. Zagnieżdżone obiekty są ignorowane.
 */
export function parseFrontmatter(text: string): { data: Record<string, FrontmatterValue>; body: string } {
  const m = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/.exec(text);
  if (!m) return { data: {}, body: text.replace(/^\uFEFF/, "") };
  const data: Record<string, FrontmatterValue> = {};
  const lines = m[1].split(/\r?\n/);
  const unquote = (s: string) => {
    const t = s.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) return t.slice(1, -1);
    return t;
  };
  for (let i = 0; i < lines.length; i++) {
    const km = /^([A-Za-z0-9_][\w .-]*?):[ \t]*(.*)$/.exec(lines[i]);
    if (!km) continue;
    const key = km[1].trim().toLowerCase();
    const rest = km[2].trim();
    if (rest === "" || rest === "|" || rest === ">") {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i++;
        items.push(unquote(lines[i].replace(/^\s*-\s+/, "")));
      }
      if (items.length) data[key] = items;
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      data[key] = rest.slice(1, -1).split(",").map(unquote).filter(Boolean);
    } else {
      data[key] = unquote(rest);
    }
  }
  return { data, body: text.slice(m[0].length) };
}

const asString = (v: FrontmatterValue | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

function asList(v: FrontmatterValue | undefined): string[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) return v;
  // `tags: a, b` albo `tags: a b` (Obsidian dopuszcza oba).
  return v.includes(",") ? v.split(",") : v.split(/\s+/);
}

/** `#projekt` → `projekt`; zagnieżdżone `a/b` zostają. */
export function cleanTags(values: string[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const t = raw.trim().replace(/^#+/, "").trim();
    if (t && t.length <= 60 && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Data z frontmatter: `2024-01-05`, `2024-01-05 14:30`, ISO; bez strefy = czas lokalny. */
export function parseFrontmatterDate(value: string): number | null {
  const s = value.trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
    // Przeliczenie (np. 45 stycznia → luty) oznacza nieprawdziwą datę.
    if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
    return d.getTime();
  }
  const p = Date.parse(s);
  return Number.isFinite(p) && p > 0 ? p : null;
}

const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/;

/** Końcowy blok `- [ ] zadanie` → lista kontrolna (reszta zostaje treścią). */
export function extractTrailingTasks(body: string): { content: string; checklist: { text: string; checked: boolean }[] } {
  const lines = body.split(/\r?\n/);
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  let start = end;
  while (start > 0 && TASK_RE.test(lines[start - 1])) start--;
  if (start === end) return { content: body.trim(), checklist: [] };
  const checklist = lines.slice(start, end).map((l) => {
    const m = TASK_RE.exec(l)!;
    return { text: m[2].trim(), checked: m[1] !== " " };
  }).filter((i) => i.text);
  return { content: lines.slice(0, start).join("\n").trim(), checklist };
}

export interface MarkdownContext {
  /** Ścieżka pliku (do raportu i tytułu zastępczego). */
  path: string;
  /** Data modyfikacji pliku — zapas, gdy frontmatter nie ma dat. */
  lastModified?: number;
  folderPath?: string[];
}

function fileTitle(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.(md|markdown)$/i, "").trim();
}

/** Parsuje jeden plik Markdown (z frontmatterem lub bez). */
export function parseMarkdownNote(text: string, ctx: MarkdownContext): ParsedNote {
  const { data, body } = parseFrontmatter(text);
  let rest = body.replace(/\r\n?/g, "\n");

  const fmTitle = asString(data.title).trim();
  const name = fileTitle(ctx.path);
  // Kolejność: frontmatter → nazwa pliku (po niej linkuje Obsidian `[[Nazwa]]`) → pierwszy `# nagłówek`.
  let title = fmTitle || name;
  const h1 = /^\s*#[ \t]+(.+?)[ \t]*#*[ \t]*(?:\n|$)/.exec(rest);
  if (h1) {
    if (!title) title = h1[1].trim();
    // Nagłówek zdublowany z tytułem nie powinien zostać w treści.
    if (h1[1].trim().toLowerCase() === title.toLowerCase()) rest = rest.slice(h1[0].length);
  }

  const { content, checklist } = extractTrailingTasks(rest);

  const labels = cleanTags([...asList(data.tags), ...asList(data.tag)]);

  const created = parseFrontmatterDate(asString(data.created ?? data.date ?? data.created_at ?? data["date created"]));
  const updated = parseFrontmatterDate(asString(data.updated ?? data.modified ?? data.updated_at ?? data["date modified"]));
  const fileTime = ctx.lastModified && ctx.lastModified > 0 ? ctx.lastModified : null;
  const truthy = (v: FrontmatterValue | undefined) => /^(true|yes|tak)$/i.test(asString(v).trim());
  // Ikona: krótki napis (emoji) bez znaków sterujących — frontmatter bywa pisany ręcznie.
  const rawIcon = asString(data.icon).trim();
  const icon = rawIcon && [...rawIcon].length <= 4 && [...rawIcon].every((c) => c.charCodeAt(0) > 31) ? rawIcon : "";

  return {
    origin: "markdown",
    source: ctx.path,
    title,
    content,
    checklist,
    labels,
    color: "default",
    pinned: truthy(data.pinned),
    ...(icon ? { icon } : {}),
    ...(truthy(data.favorite) ? { favorite: true } : {}),
    archived: truthy(data.archived),
    trashed: false,
    createdAt: created ?? null,
    updatedAt: updated ?? created ?? fileTime,
    folderPath: ctx.folderPath ?? [],
    attachments: [],
  };
}

/** Liczba osadzeń obrazów w treści (`![[x.png]]`, `![](x.png)`), których import nie przenosi. */
export function countImageEmbeds(text: string): number {
  const wiki = text.match(/!\[\[[^\]\n]+\.(?:png|jpe?g|gif|webp|bmp|avif|svg)(?:\|[^\]\n]*)?\]\]/gi)?.length ?? 0;
  const md = text.match(/!\[[^\]\n]*\]\((?!https?:|data:)[^)\n]+\)/gi)?.length ?? 0;
  return wiki + md;
}
