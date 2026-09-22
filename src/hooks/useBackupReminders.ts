import { useEffect } from "react";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import { exportToJSON } from "@/lib/exportNotes";
import { isBackupOverdue, markBackup, daysSinceBackup } from "@/lib/backupReminder";

export interface BackupReminderPrefs {
  autoExportDays: number;
  backupReminderDays: number;
}

/** Auto-backup download + "time to back up" nudge, each firing at most once per session. */
export function useBackupReminders(prefs: BackupReminderPrefs, notes: Note[], archivedNotes: Note[]) {
  // Auto-backup: trigger JSON download in background if interval has passed
  useEffect(() => {
    if (!prefs.autoExportDays || prefs.autoExportDays <= 0) return;
    if (notes.length === 0 && archivedNotes.length === 0) return;
    const last = Number(localStorage.getItem("kaczy.lastAutoExport") || 0);
    const due = Date.now() - last > prefs.autoExportDays * 24 * 60 * 60 * 1000;
    if (!due) return;
    if (sessionStorage.getItem("kaczy.autoBackupDone") === "1") return;
    sessionStorage.setItem("kaczy.autoBackupDone", "1");
    const t = setTimeout(() => {
      try {
        const { filename, size } = exportToJSON([...notes, ...archivedNotes]);
        markBackup();
        const kb = Math.max(1, Math.round(size / 1024));
        toast.success("📦 Auto-backup pobrany w tle", {
          description: `${filename} • ${kb} KB • ${notes.length + archivedNotes.length} notatek`,
          duration: 8000,
        });
      } catch {
        toast.error("Auto-backup nie powiódł się");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [prefs.autoExportDays, notes, archivedNotes]);

  // Backup reminder: nudge if last backup is older than reminderDays
  useEffect(() => {
    if (!prefs.backupReminderDays || prefs.backupReminderDays <= 0) return;
    if (!isBackupOverdue(prefs.backupReminderDays)) return;
    if (sessionStorage.getItem("kaczy.backupNudge") === "1") return;
    sessionStorage.setItem("kaczy.backupNudge", "1");
    const t = setTimeout(() => {
      const days = daysSinceBackup();
      const desc = days === null
        ? "Nie masz jeszcze żadnej kopii zapasowej."
        : `Ostatni backup: ${days === 0 ? "dziś" : `${days} dni temu`}.`;
      toast("💾 Czas na backup", {
        description: desc,
        duration: 12000,
        action: {
          label: "Pobierz JSON",
          onClick: () => {
            try {
              exportToJSON([...notes, ...archivedNotes]);
              markBackup();
              toast.success("Backup pobrany 💾");
            } catch {
              toast.error("Nie udało się wygenerować backupu");
            }
          },
        },
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [prefs.backupReminderDays, notes, archivedNotes]);
}
