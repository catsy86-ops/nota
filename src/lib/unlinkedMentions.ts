import type { Note } from "@/hooks/useNotes";
import { extractWikiLinks } from "@/lib/wikiLinks";

/** Najkrótszy tytuł, który ma sens jako wzmianka („do”, „a” trafiałyby wszędzie). */
export const MIN_MENTION_TITLE = 3;

export interface UnlinkedMention {
  id: string;
  title: string;
  /** Fragment treści wokół wzmianki (do podglądu przy przycisku „Połącz”). */
  before: string;
  match: string;
  after: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Zakresy, w których wzmianka się nie liczy: `[[...]]`, bloki ``` i `kod`. */
function protectedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const rx = /```[\s\S]*?(?:```|$)|`[^`\n]*`|\[\[[^[\]\n]*\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function inRanges(pos: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([a, b]) => pos < b && end > a);
}

/** Pierwsze wystąpienie tytułu jako całego słowa, poza linkami i kodem. */
export function findMention(content: string, title: string): { index: number; length: number } | null {
  const t = title.trim();
  if (t.length < MIN_MENTION_TITLE || !content) return null;
  const rx = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(t)}(?![\\p{L}\\p{N}_])`, "giu");
  const ranges = protectedRanges(content);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(content)) !== null) {
    if (!inRanges(m.index, m.index + m[0].length, ranges)) return { index: m.index, length: m[0].length };
  }
  return null;
}

/**
 * Zamienia pierwszą wzmiankę na `[[tytuł]]`. Zachowuje pisownię z tekstu
 * (wielkość liter), bo linki rozpoznają tytuł bez jej rozróżniania.
 * `null`, gdy nie ma czego łączyć.
 */
export function linkFirstMention(content: string, title: string): string | null {
  const hit = findMention(content, title);
  if (!hit) return null;
  const match = content.slice(hit.index, hit.index + hit.length);
  return `${content.slice(0, hit.index)}[[${match}]]${content.slice(hit.index + hit.length)}`;
}

/**
 * Notatki, które zawierają tytuł `target`, a jej nie linkują. Pomija samą
 * notatkę, kosz, notatki o tym samym tytule i te, które już mają `[[tytuł]]`.
 */
export function findUnlinkedMentions(target: Pick<Note, "id" | "title"> & { locked?: boolean }, notes: Note[], limit = 50): UnlinkedMention[] {
  if (target.locked) return [];
  const title = target.title.trim();
  if (title.length < MIN_MENTION_TITLE) return [];
  const lower = title.toLowerCase();
  const out: UnlinkedMention[] = [];
  for (const n of notes) {
    if (n.id === target.id || n.trashed || n.locked) continue;
    if (n.title.trim().toLowerCase() === lower) continue;
    if (!n.content || !n.content.toLowerCase().includes(lower)) continue;
    if (extractWikiLinks(n.content).includes(lower)) continue;
    const hit = findMention(n.content, title);
    if (!hit) continue;
    const end = hit.index + hit.length;
    const from = Math.max(0, hit.index - 30);
    out.push({
      id: n.id,
      title: n.title.trim(),
      before: (from > 0 ? "…" : "") + n.content.slice(from, hit.index).replace(/\s+/g, " "),
      match: n.content.slice(hit.index, end),
      after: n.content.slice(end, end + 40).replace(/\s+/g, " ") + (end + 40 < n.content.length ? "…" : ""),
    });
    if (out.length >= limit) break;
  }
  return out;
}
