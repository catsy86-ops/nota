import { imageStore } from "@/lib/imageStore";
import { updateJournalEntry } from "@/lib/study/store";
import type { JournalEntry } from "@/lib/study/yStudy";

/** Najdłuższy bok miniatury po zakończeniu budowy (P-4, plan Pracy 3.3). */
export const SHRINK_MAX_SIDE = 800;

/** Nowe wymiary tak, by dłuższy bok był co najwyżej `max`; `null` = już mieści się (nic nie robić). */
export function shrinkDimensions(width: number, height: number, max = SHRINK_MAX_SIDE): { width: number; height: number } | null {
  const longest = Math.max(width, height);
  if (longest <= max) return null;
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** Miniatura JPEG zdjęcia; `null`, gdy przeglądarka nie umie albo zdjęcie jest już małe. */
async function thumbnail(blob: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) return null;
  const size = shrinkDimensions(bitmap.width, bitmap.height);
  if (!size) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85));
}

/** Podmienia zdjęcia wpisów budowy na miniatury (ref → nowy ref). Oryginały znikają z magazynu przy GC. */
export async function shrinkSitePhotos(entries: readonly JournalEntry[]): Promise<{ shrunk: number; skipped: number }> {
  const refs = Array.from(new Set(entries.flatMap((e) => e.images)));
  const map = new Map<string, string>();
  let skipped = 0;
  for (const ref of refs) {
    const rec = await imageStore.get(ref).catch(() => undefined);
    const blob = rec ? new Blob([rec.bytes], { type: rec.type }) : null;
    const small = blob ? await thumbnail(blob).catch(() => null) : null;
    if (!small) { skipped++; continue; }
    map.set(ref, await imageStore.putBlob(small));
  }
  for (const e of entries) {
    if (!e.images.some((r) => map.has(r))) continue;
    const images = e.images.map((r) => map.get(r) ?? r);
    const captions = Object.fromEntries(Object.entries(e.captions ?? {}).map(([r, t]) => [map.get(r) ?? r, t]));
    updateJournalEntry(e.id, {
      kind: e.kind, topic: e.topic, text: e.text, checked: e.checked, images, captions,
      recordings: e.recordings, at: e.at, test: e.test ?? null, fittings: e.fittings, pipes: e.pipes, stage: e.stage ?? null,
      geo: e.geo ?? null, site: e.site, resolved: e.resolved ?? null,
    });
  }
  return { shrunk: map.size, skipped };
}
