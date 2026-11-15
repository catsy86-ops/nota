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
