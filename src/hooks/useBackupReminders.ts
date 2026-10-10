import { useEffect } from "react";
import { toast } from "sonner";
import type { Note } from "@/hooks/useNotes";
import { describeSkippedAttachments, exportFullBackup } from "@/lib/exportNotes";
import { isBackupDue, markBackup, daysSinceBackup, getLastBackup, oldestCreatedAt } from "@/lib/backupReminder";

export interface BackupReminderPrefs {
  autoExportDays: number;
  backupReminderDays: number;
}

/** Auto-backup download + "time to back up" nudge, each firing at most once per session. */
export function useBackupReminders(prefs: BackupReminderPrefs, notes: Note[], archivedNotes: Note[]) {
  // Auto-backup: trigger JSON download in background if interval has passed
  useEffect(() => {
    if (!isBackupDue(prefs.autoExportDays, oldestCreatedAt(notes, archivedNotes))) return;
    const last = getLastBackup();
    if (sessionStorage.getItem("kaczy.autoBackupDone") === "1") return;
    sessionStorage.setItem("kaczy.autoBackupDone", "1");
    const t = setTimeout(async () => {
      try {
        // Bez gestu użytkownika działa tylko zapis do wybranego pliku
        // (File System Access). Inaczej nie udajemy pobrania „w tle” —
        // prosimy o jedno kliknięcie, a backup liczy się dopiero wtedy.
        const { filename, size, savedToFile, attachments } = await exportFullBackup(undefined, { allowDownload: false });
        const count = notes.length + archivedNotes.length;
        if (savedToFile) {
          markBackup();
          const kb = Math.max(1, Math.round(size / 1024));
          const skipped = describeSkippedAttachments(attachments);
          toast.success("Auto-backup zapisany", { description: `${filename} • ${kb} KB • ${count} notatek${skipped ? ` — ${skipped}` : ""}`, duration: skipped ? 14000 : 8000 });
          return;
        }
        toast("Czas na backup", {
          id: "auto-backup",
          description: last
            ? `Minęło ${prefs.autoExportDays} dni od ostatniego. Pobierz plik z ${count} ${count === 1 ? "notatką" : "notatkami"}.`
            : `Nie masz jeszcze kopii zapasowej. Pobierz plik z ${count} ${count === 1 ? "notatką" : "notatkami"}.`,
          // Nie wisi bez końca nad notatkami — wróci przy następnym otwarciu.
          duration: 20000,
          action: {
            label: "Pobierz",
            onClick: async () => {
              try {
                const res = await exportFullBackup();
                markBackup();
                toast.success(res.savedToFile ? "Backup zapisany" : "Backup pobrany", { description: res.filename });
              } catch {
                toast.error("Nie udało się wygenerować backupu");
              }
            },
          },
        });
      } catch {
        toast.error("Auto-backup nie powiódł się");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [prefs.autoExportDays, notes, archivedNotes]);

  // Backup reminder: nudge if last backup is older than reminderDays
  useEffect(() => {
    // Pusta baza (np. pierwsze uruchomienie) nie ma czego backupować.
    if (!isBackupDue(prefs.backupReminderDays, oldestCreatedAt(notes, archivedNotes))) return;
    if (sessionStorage.getItem("kaczy.backupNudge") === "1") return;
    // Auto-backup w tej sesji już o to poprosił — drugi toast o tym samym to szum.
    if (sessionStorage.getItem("kaczy.autoBackupDone") === "1") return;
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
          label: "Zrób backup",
          onClick: async () => {
            try {
              const { savedToFile } = await exportFullBackup();
              markBackup();
              toast.success(savedToFile ? "Backup zapisany 💾" : "Backup pobrany 💾");
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
