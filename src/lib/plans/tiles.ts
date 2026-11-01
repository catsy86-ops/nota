/**
 * Kafle do OCR: duży plan dzielimy na kawałki z zakładką (napis na granicy kafla trafia w całości do
 * sąsiedniego), a prostokąty słów przeliczamy z układu kafla (i ewentualnej kopii roboczej) na piksele
 * oryginału. Słowo odczytane dwa razy w zakładce zostaje raz.
 */

export interface Rect { x: number; y: number; w: number; h: number }

export const OCR_TILE = 2048;
export const OCR_OVERLAP = 144;

/** Siatka kafli pokrywająca obraz `w`×`h`; kafle na krawędzi są mniejsze, nie wychodzą poza obraz. */
export function tileGrid(w: number, h: number, tile = OCR_TILE, overlap = OCR_OVERLAP): Rect[] {
  const step = Math.max(1, tile - overlap);
  const starts = (len: number) => {
    const out: number[] = [];
    for (let s = 0; ; s += step) {
      if (s + tile >= len) { out.push(Math.max(0, len - tile)); break; }
      out.push(s);
    }
    return [...new Set(out)];
  };
  const rects: Rect[] = [];
  for (const y of starts(h)) for (const x of starts(w)) rects.push({ x, y, w: Math.min(tile, w), h: Math.min(tile, h) });
  return rects;
}

/** Prostokąt z kafla (piksele kafla) → piksele oryginału; `k` = szerokość oryginału / szerokość obrazu kafli. */
export function tileToImage(tile: Rect, box: Rect, k: number): Rect {
  return { x: (tile.x + box.x) * k, y: (tile.y + box.y) * k, w: box.w * k, h: box.h * k };
}

const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

/** Część wspólna przez mniejszy prostokąt — słowo przecięte krawędzią kafla też liczy się jako to samo. */
export function overlapRatio(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1, Math.min(area(a), area(b)));
}

/**
 * Usuwa powtórzenia słów z zakładek: przy dużej części wspólnej zostaje słowo o wyższej pewności
 * (przy remisie — dłuższe, bo przecięte krawędzią jest zwykle ucięte).
 */
export function dedupeWords<T extends { box: Rect; confidence: number; text: string }>(words: readonly T[], threshold = 0.6): T[] {
  const sorted = [...words].sort((a, b) => b.confidence - a.confidence || b.text.length - a.text.length);
  const kept: T[] = [];
  for (const w of sorted) if (!kept.some((k) => overlapRatio(k.box, w.box) >= threshold)) kept.push(w);
  return kept;
}
