/**
 * There's no backend/cloud — IndexedDB is the only copy of the user's data.
 * Without `persist()`, browsers may silently evict "best-effort" storage
 * under disk pressure (most realistic on mobile / after long inactivity).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!("storage" in navigator) || !navigator.storage.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageInfo {
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
  /** Pamięć podręczna (pliki aplikacji z service workera) — tylko Chromium podaje `usageDetails`. */
  cachesBytes?: number;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (!("storage" in navigator)) {
    return { persisted: false, usageBytes: null, quotaBytes: null };
  }
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted?.().catch(() => false) ?? Promise.resolve(false),
    navigator.storage.estimate?.().catch(() => null) ?? Promise.resolve(null),
  ]);
  return {
    persisted,
    usageBytes: estimate?.usage ?? null,
    quotaBytes: estimate?.quota ?? null,
    ...(typeof (estimate as { usageDetails?: { caches?: unknown } } | null)?.usageDetails?.caches === "number"
      ? { cachesBytes: (estimate as { usageDetails: { caches: number } }).usageDetails.caches }
      : {}),
  };
}

/** Ułamek zajętego miejsca (0–1) albo null, gdy przeglądarka nie podaje limitu. */
export function storageFill(info: StorageInfo): number | null {
  if (info.usageBytes === null || !info.quotaBytes) return null;
  return info.usageBytes / info.quotaBytes;
}

/** Ostrzeżenie przy > 80% zajętego miejsca; null, gdy nie ma powodu. */
export function storageWarning(info: StorageInfo): string | null {
  const fill = storageFill(info);
  if (fill === null || fill <= 0.8) return null;
  return `Zajęte ${Math.round(fill * 100)}% miejsca dostępnego dla aplikacji. Zrób kopię i zmniejsz zdjęcia, zanim zapis zacznie się nie udawać.`;
}

export interface StorageBreakdown {
  /** Zdjęcia, nagrania i dokumenty z magazynu plików. */
  files: number;
  /** Pliki aplikacji w pamięci podręcznej; `undefined`, gdy przeglądarka nie podaje. */
  app?: number;
  /** Reszta: notatki, Grafik, Praca i inne dane. Nigdy poniżej zera (szacunki przeglądarki są zaokrąglane). */
  data: number;
}

/** U3.3: podział zajętego miejsca — z całości odejmujemy zmierzone pliki i pamięć podręczną. */
export function storageBreakdown(usageBytes: number, filesBytes: number, cachesBytes?: number): StorageBreakdown {
  const app = cachesBytes !== undefined ? Math.max(0, cachesBytes) : undefined;
  return { files: filesBytes, ...(app !== undefined ? { app } : {}), data: Math.max(0, usageBytes - filesBytes - (app ?? 0)) };
}
