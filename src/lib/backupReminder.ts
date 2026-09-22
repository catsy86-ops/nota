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

export function isBackupOverdue(reminderDays: number): boolean {
  if (!reminderDays || reminderDays <= 0) return false;
  const last = getLastBackup();
  // No backup yet → overdue only if user has had the app for a while; we just trigger.
  if (!last) return true;
  return Date.now() - last > reminderDays * 24 * 60 * 60 * 1000;
}
