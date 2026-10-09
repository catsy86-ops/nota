/** Shared last-backup timestamp. Reuses the auto-export key so manual & auto backups share state. */
const KEY = "kaczy.lastAutoExport";

export function getLastBackup(): number {
  try { return Number(localStorage.getItem(KEY) || 0); } catch { return 0; }
}

export function markBackup() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
}

export function daysSinceBackup(): number | null {
  const last = getLastBackup();
  if (!last) return null;
  return Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
}

/**
 * Zaległość liczona od ostatniego backupu, a bez niego — od najstarszej
 * notatki: pierwszego dnia z aplikacją nie ma jeszcze czego tracić,
 * więc prośba o kopię przychodzi dopiero po `days` dniach notowania.
 */
export function isBackupDue(days: number, oldestNoteAt: number | null): boolean {
  if (!days || days <= 0) return false;
  const since = getLastBackup() || oldestNoteAt;
  if (!since) return false;
  return Date.now() - since > days * 24 * 60 * 60 * 1000;
}

/** Najstarsza data utworzenia albo `null` dla pustej bazy. */
export function oldestCreatedAt(...lists: { createdAt: number }[][]): number | null {
  let min = Infinity;
  for (const list of lists) for (const n of list) if (n.createdAt < min) min = n.createdAt;
  return Number.isFinite(min) ? min : null;
}
