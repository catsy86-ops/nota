import type { NoteColor } from "@/hooks/useNotes";
import type { AttachmentRef, ParsedNote } from "./types";

/** Kolory Keep → kolory aplikacji (najbliższy odcień; szary i domyślny = bez koloru). */
const KEEP_COLORS: Record<string, NoteColor> = {
  DEFAULT: "default",
  RED: "coral",
  ORANGE: "peach",
  YELLOW: "sand",
  BROWN: "sand",
  GREEN: "mint",
  TEAL: "sage",
  BLUE: "sky",
  CERULEAN: "sky",
  PURPLE: "lavender",
  PINK: "rose",
  GRAY: "default",
};

export function mapKeepColor(raw: unknown): NoteColor {
  return typeof raw === "string" ? KEEP_COLORS[raw.toUpperCase()] ?? "default" : "default";
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Mikrosekundy Keep → ms; `null` dla braku/nonsensu. */
function usecToMs(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = Math.round(n / 1000);
  // Odrzuć daty sprzed 2000 r. i z odległej przyszłości — to nie są znaczniki Keep.
  return ms > 946_684_800_000 && ms < 4_102_444_800_000 ? ms : null;
}

/** Czy obiekt wygląda jak eksport notatki Keep (a nie dowolny JSON z folderu). */
export function looksLikeKeepJson(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  const hasBody = "textContent" in o || "listContent" in o || "title" in o;
  const hasMeta = "createdTimestampUsec" in o || "userEditedTimestampUsec" in o || "isTrashed" in o || "isArchived" in o || "color" in o;
  return hasBody && hasMeta;
}

function cleanLabels(names: unknown[]): string[] {
  const out: string[] = [];
  for (const n of names) {
    const s = str(n).trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

/**
 * Parsuje jeden plik .json z Takeout → Keep. Rzuca przy niepoprawnym JSON-ie;
 * zwraca `null`, gdy to poprawny JSON, ale nie notatka Keep.
 */
export function parseKeepJson(text: string, source: string): ParsedNote | null {
  const raw: unknown = JSON.parse(text);
  if (!looksLikeKeepJson(raw)) return null;

  const attachments: AttachmentRef[] = [];
  if (Array.isArray(raw.attachments)) {
    for (const a of raw.attachments) {
      if (a && typeof a === "object") {
        const fp = str((a as Record<string, unknown>).filePath);
        if (fp) attachments.push({ filePath: fp, mimeType: str((a as Record<string, unknown>).mimetype) });
      }
    }
  }

  let content = str(raw.textContent);
  // Linki z notatek Keep (adnotacje WEBLINK) — jako zwykłe linki Markdown pod treścią.
  if (Array.isArray(raw.annotations)) {
    const links: string[] = [];
    for (const a of raw.annotations) {
      if (!a || typeof a !== "object") continue;
      const o = a as Record<string, unknown>;
      const url = str(o.url);
      if (!/^https?:\/\//i.test(url)) continue;
      if (content.includes(url)) continue;
      const title = str(o.title).replace(/[[\]\n]/g, " ").trim();
      links.push(title ? `[${title}](${url})` : url);
    }
    if (links.length) content = content ? `${content}\n\n${links.join("\n")}` : links.join("\n");
  }

  const checklist: ParsedNote["checklist"] = [];
  if (Array.isArray(raw.listContent)) {
    for (const it of raw.listContent) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      const t = str(o.text);
      if (!t.trim()) continue;
      checklist.push({ text: t, checked: o.isChecked === true });
    }
  }

  const labels = Array.isArray(raw.labels)
    ? cleanLabels(raw.labels.map((l) => (l && typeof l === "object" ? (l as Record<string, unknown>).name : l)))
    : [];

  return {
    origin: "keep",
    source,
    title: str(raw.title),
    content,
    checklist,
    labels,
    color: mapKeepColor(raw.color),
    pinned: raw.isPinned === true,
    archived: raw.isArchived === true,
    trashed: raw.isTrashed === true,
    createdAt: usecToMs(raw.createdTimestampUsec),
    updatedAt: usecToMs(raw.userEditedTimestampUsec),
    folderPath: [],
    attachments,
  };
}

// --- HTML -------------------------------------------------------------------

const BLOCK_TAGS = new Set(["DIV", "P", "LI", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "TR"]);

/** Tekst elementu: <br> → nowa linia, bloki rozdzielone nową linią. Bez innerHTML — tylko `data` węzłów. */
function elementText(root: Node): string {
  let out = "";
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { out += (child as Text).data; continue; }
      if (child.nodeType !== 1) continue;
      const el = child as Element;
      const tag = el.tagName.toUpperCase();
      if (tag === "SCRIPT" || tag === "STYLE") continue;
      if (tag === "BR") { out += "\n"; continue; }
      const block = BLOCK_TAGS.has(tag);
      if (block && out && !out.endsWith("\n")) out += "\n";
      walk(el);
      if (block && out && !out.endsWith("\n")) out += "\n";
    }
  };
  walk(root);
  return out;
}

const tidy = (s: string) => s.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

const MONTHS: Record<string, number> = {
  sty: 0, lut: 1, mar: 2, kwi: 3, maj: 4, cze: 5, lip: 6, sie: 7, wrz: 8, paź: 9, paz: 9, lis: 10, gru: 11,
  jan: 0, feb: 1, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** „17 mar 2020, 12:03:11” (PL/EN) albo coś, co rozumie `Date.parse`. */
export function parseKeepHeadingDate(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{1,2})\s+([A-Za-zżźćńółęąśŻŹĆŃÓŁĘĄŚ]+)\.?,?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon !== undefined) {
      const d = new Date(Number(m[3]), mon, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
      if (!Number.isNaN(d.getTime())) return d.getTime();
    }
  }
  const p = Date.parse(t);
  return Number.isFinite(p) && p > 946_684_800_000 ? p : null;
}

const IMG_MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", avif: "image/avif" };

export function imageMimeFromName(name: string): string | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  return ext ? IMG_MIME[ext] ?? null : null;
}

/** Czy HTML wygląda jak eksport Keep (ma kontener `.note` z `.content`/`.list`/`.title`). */
export function looksLikeKeepHtml(html: string): boolean {
  return /class="[^"]*\bnote\b/.test(html) && /class="[^"]*\b(content|listitem|title)\b/.test(html);
}

/**
 * Parsuje .html z Takeout → Keep. `DOMParser` tworzy odrębny, nieaktywny dokument
 * (skrypty się nie wykonują, nic nie trafia do DOM aplikacji); czytamy wyłącznie tekst.
 */
export function parseKeepHtml(html: string, source: string): ParsedNote | null {
  if (!looksLikeKeepHtml(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const note = doc.querySelector(".note") ?? doc.body;

  const title = tidy(elementText(note.querySelector(".title") ?? doc.createElement("div")));
  const contentEl = note.querySelector(".content");
  const content = contentEl ? tidy(elementText(contentEl)) : "";

  const checklist: ParsedNote["checklist"] = [];
  note.querySelectorAll("li.listitem").forEach((li) => {
    const text = tidy(elementText(li.querySelector(".text") ?? li));
    if (!text) return;
    const bullet = li.querySelector(".bullet")?.textContent ?? "";
    checklist.push({ text, checked: /[☑☒✓✔]/.test(bullet) });
  });

  const labels: string[] = [];
  note.querySelectorAll(".chip.label .label-name, .label .label-name").forEach((el) => {
    const t = (el.textContent ?? "").trim();
    if (t && !labels.includes(t)) labels.push(t);
  });

  const attachments: AttachmentRef[] = [];
  note.querySelectorAll(".attachments img, img.attachment").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (!src || /^(data|https?|blob|javascript):/i.test(src)) return;
    attachments.push({ filePath: decodeURIComponentSafe(src), mimeType: imageMimeFromName(src) ?? "" });
  });

  const classes = Array.from(note.classList);
  const colorToken = classes.find((c) => c.toUpperCase() in KEEP_COLORS);

  // Data: tekst nagłówka bez zagnieżdżonych elementów (ikony, „Archived”).
  let heading = "";
  const headingEl = note.querySelector(".heading");
  if (headingEl) {
    for (const n of Array.from(headingEl.childNodes)) if (n.nodeType === 3) heading += (n as Text).data;
  }
  const createdAt = parseKeepHeadingDate(heading);

  return {
    origin: "keep",
    source,
    title,
    content,
    checklist,
    labels,
    color: mapKeepColor(colorToken),
    pinned: !!note.querySelector(".pinned"),
    archived: !!doc.querySelector(".archived"),
    trashed: !!doc.querySelector(".trashed"),
    createdAt,
    updatedAt: createdAt,
    folderPath: [],
    attachments,
  };
}

function decodeURIComponentSafe(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}
