import { toast } from "@/lib/notify";
import { describeSkippedAttachments, type BackupAttachmentReport } from "@/lib/backup/build";
import { BACKUP_OVERSIZE_NOTE } from "@/lib/backup/parse";
import { exportFullBackup, shareFullBackup } from "@/lib/backup/download";
import { LAST_AUTO_EXPORT_KEY } from "@/lib/backupReminder";

export { canShareBackupFile } from "./canShare";

/**
 * „Pobierz pełną kopię teraz” i „Wyślij kopię” z komunikatami — wspólne dla Ustawień → Kopia i dane i palety
 * (Powłoka 2.5). Wydzielone z `BackupSettings.tsx` bez zmian zachowania.
 */

/** D3: pytanie, gdy kopia pominie załączniki. Zwraca `true`, gdy użytkownik chce zapisać mimo to. */
export type SkipConfirm = (report: BackupAttachmentReport) => Promise<boolean>;

export async function exportNow(confirm: SkipConfirm): Promise<void> {
  try {
    const res = await exportFullBackup(undefined, { confirm });
    if (res.cancelled) return;
    const { savedToFile, attachments } = res;
    try { localStorage.setItem(LAST_AUTO_EXPORT_KEY, String(Date.now())); } catch { /* ignore */ }
    const skipped = describeSkippedAttachments(attachments);
    if (res.oversize) toast.warning(savedToFile ? "Kopia zapisana, ale jest za duża do wczytania" : "Kopia pobrana, ale jest za duża do wczytania", { description: BACKUP_OVERSIZE_NOTE, duration: 15000 });
    else toast.success(savedToFile ? "Kopia zapisana 💾" : "Kopia pobrana 💾", skipped ? { description: skipped, duration: 12000 } : undefined);
  } catch {
    toast.error("Nie udało się zrobić kopii");
  }
}

export async function shareNow(confirm: SkipConfirm): Promise<void> {
  try {
    const res = await shareFullBackup(confirm);
    if (res === "unsupported") toast.error("Ta przeglądarka nie udostępnia plików — pobierz kopię");
    else if (res === "shared") toast.success("Wysłano kopię");
  } catch {
    toast.error("Nie udało się wysłać kopii");
  }
}
