import { fold } from "@/lib/searchQuery";

/**
 * Wyróżnianie trafień w kaflach. Dopasowanie idzie po `fold` — tej samej normalizacji co
 * wyszukiwarka (bez ogonków, małe litery), więc „zolw” trafia w „żółw”. Każdy znak tekstu
 * zachowuje swoją pozycję w oryginale, dzięki czemu zaznaczamy fragment, jaki widzi użytkownik.
 */

interface Folded {
  chars: string;
  /** Pozycja w oryginale, z której pochodzi znak składanego tekstu. */
  from: number[];
  /** Koniec (wyłącznie) tego samego fragmentu w oryginale. */
  to: number[];
}

function foldWithMap(text: string): Folded {
  let chars = "";
  const from: number[] = [];
  const to: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const f = fold(text[i]);
    for (const c of f) {
      chars += c;
      from.push(i);
      to.push(i + 1);
    }
  }
  return { chars, from, to };
}

export interface HighlightPart { text: string; hit: boolean }

/** Tekst podzielony na fragmenty z trafieniem i bez. Puste tokeny są pomijane. */
export function matchParts(text: string, tokens: readonly string[]): HighlightPart[] {
  const needles = tokens.map((t) => fold(t)).filter((t) => t.length > 0);
  if (!text || needles.length === 0) return [{ text, hit: false }];

  const f = foldWithMap(text);
  const ranges: [number, number][] = [];
  for (const needle of needles) {
    let at = f.chars.indexOf(needle);
    while (at !== -1) {
      const start = f.from[at];
      const end = f.to[at + needle.length - 1];
      if (start !== undefined && end !== undefined) ranges.push([start, end]);
      at = f.chars.indexOf(needle, at + needle.length);
    }
  }
  if (ranges.length === 0) return [{ text, hit: false }];

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }

  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) parts.push({ text: text.slice(cursor, s), hit: false });
    parts.push({ text: text.slice(s, e), hit: true });
    cursor = e;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false });
  return parts;
}

/** Pierwsze trafienie w treści z kontekstem — do zapowiedzi kafla, gdy trafienie jest tylko w treści. */
export function firstSnippet(text: string, tokens: readonly string[], radius = 40): { before: string; match: string; after: string } | null {
  const parts = matchParts(text, tokens);
  const at = parts.findIndex((p) => p.hit);
  if (at === -1) return null;
  const before = parts.slice(0, at).map((p) => p.text).join("");
  const match = parts[at].text;
  const after = parts.slice(at + 1).map((p) => p.text).join("");
  const cut = before.length > radius ? "…" + before.slice(before.length - radius) : before;
  const tail = after.length > radius ? after.slice(0, radius) + "…" : after;
  return { before: cut, match, after: tail };
}
