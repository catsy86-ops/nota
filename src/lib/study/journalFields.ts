/**
 * Wpis dziennika w dokumencie to mapa pól (`Y.Map`, D5) albo — w starszych zapisach — zwykły obiekt.
 * Zwraca zwykły obiekt pól, żeby czytający (`cleanEntry`, raporty kopii) nie musieli znać `yjs`.
 * Bez importu `yjs`: moduły spoza `yStudy.ts` (np. `journalRefs.ts`) też tego używają.
 */
export function journalFields(raw: unknown): unknown {
  if (!isMapLike(raw)) return raw;
  const out: Record<string, unknown> = {};
  for (const [k, v] of raw.entries()) {
    // Odhaczone punkty to mapa `id → true` (krok 3 planu Etap 6); czytający dostają z powrotem tablicę id.
    if (k === "checked" && isMapLike(v)) out[k] = Array.from(v.keys());
    else out[k] = v;
  }
  return out;
}

function isMapLike(v: unknown): v is Map<string, unknown> {
  return !!v && typeof v === "object" && typeof (v as { entries?: unknown }).entries === "function" && typeof (v as { get?: unknown }).get === "function";
}
