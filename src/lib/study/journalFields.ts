/**
 * Wpis dziennika w dokumencie to mapa pól (`Y.Map`, D5) albo — w starszych zapisach — zwykły obiekt.
 * Zwraca zwykły obiekt pól, żeby czytający (`cleanEntry`, raporty kopii) nie musieli znać `yjs`.
 * Bez importu `yjs`: moduły spoza `yStudy.ts` (np. `journalRefs.ts`) też tego używają.
 */
export function journalFields(raw: unknown): unknown {
  if (raw && typeof raw === "object" && typeof (raw as { entries?: unknown }).entries === "function" && typeof (raw as { get?: unknown }).get === "function") {
    return Object.fromEntries((raw as Map<string, unknown>).entries());
  }
  return raw;
}
