import { READ_WPM } from "@/lib/viewPrefs";
import { charsPl, wordsPl } from "@/lib/plural";

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export interface TextStats {
  words: number;
  chars: number;
  /** Minuty czytania; 0 dla pustego tekstu, inaczej co najmniej 1. */
  minutes: number;
}

export function textStats(text: string): TextStats {
  const words = countWords(text);
  return { words, chars: text.length, minutes: words === 0 ? 0 : Math.max(1, Math.round(words / READ_WPM)) };
}

/** „12 słów · 80 znaków · ~1 min czytania” albo, przy zaznaczeniu, „Zaznaczono 12 słów · 80 znaków”. */
export function statsLabel(text: string, selStart = 0, selEnd = 0): string {
  const [a, b] = selStart <= selEnd ? [selStart, selEnd] : [selEnd, selStart];
  if (b > a) {
    const sel = text.slice(a, b);
    const words = countWords(sel);
    if (words > 0) return `Zaznaczono ${wordsPl(words)} · ${charsPl(sel.length)}`;
  }
  const s = textStats(text);
  const base = `${wordsPl(s.words)} · ${charsPl(s.chars)}`;
  return s.minutes > 0 ? `${base} · ~${s.minutes} min czytania` : base;
}
