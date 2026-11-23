import { useEffect } from "react";
import { toast } from "sonner";
import { whenNotesReady, type Note } from "@/hooks/useNotes";
/** Eksport poza paczką startową (Plan-nowy 1.5) — ładowany dopiero, gdy kopia jest potrzebna. */
const loadExport = () => import("@/lib/exportNotes");
import { AUTO_BACKUP_LOCK, withLockIfFree } from "@/lib/tabLock";
import { isBackupDue, markBackup, daysSinceBackup, getLastBackup, oldestCreatedAt, FILE_BACKUP_DAYS } from "@/lib/backupReminder";
import { hasBackupFile } from "@/lib/backupFileHandle";
import { useLatestRef } from "@/hooks/useLatestRef";
import { DANE } from "@/lib/storage/names";

export interface BackupReminderPrefs {
  autoExportDays: number;
  backupReminderDays: number;
}

/** Auto-backup download + "time to back up" nudge, each firing at most once per session. */
export function useBackupReminders(prefs: BackupReminderPrefs, notes: Note[], archivedNotes: Note[]) {
  // Auto-backup. QL-2: z wybranym plikiem (File System Access) zapis bez pytania raz dziennie — przy otwarciu i przy
  // schowaniu aplikacji; bez pliku jak dotąd: po interwale `autoExportDays` prośba o jedno kliknięcie „Pobierz”.
  // `autoExportDays === 0` wyłącza oba.
  const latest = useLatestRef({ prefs, notes, archivedNotes });
  useEffect(() => {
    if (prefs.autoExportDays === 0) return;
    const oldest = () => oldestCreatedAt(latest.current.notes, latest.current.archivedNotes);
    const due = async () => isBackupDue(prefs.autoExportDays, oldest()) || ((await hasBackupFile()) && isBackupDue(FILE_BACKUP_DAYS, oldest()));
    const t = setTimeout(async () => {
      // Notatki muszą być wczytane — od najstarszej liczy się zaległość pierwszej kopii.
      await whenNotesReady();
      if (sessionStorage.getItem(DANE.autoBackupDone) === "1" || !(await due())) return;
      sessionStorage.setItem(DANE.autoBackupDone, "1");
      const last = getLastBackup();
      // Z-7.3: jedna karta naraz; zajęte = inna karta właśnie robi kopię, ta pomija przebieg.
      void withLockIfFree(AUTO_BACKUP_LOCK, async () => {
        // Po wejściu w blokadę sprawdzamy od nowa: inna karta mogła przed chwilą zapisać kopię.
        if (!(await due())) return;
        try {
          // Bez gestu użytkownika działa tylko zapis do wybranego pliku
          // (File System Access). Inaczej nie udajemy pobrania „w tle” —
          // prosimy o jedno kliknięcie, a backup liczy się dopiero wtedy.
          const { exportFullBackup, describeSkippedAttachments, BACKUP_OVERSIZE_NOTE } = await loadExport();
          const { filename, size, savedToFile, attachments, oversize } = await exportFullBackup(undefined, { allowDownload: false });
          const count = latest.current.notes.length + latest.current.archivedNotes.length;
          if (savedToFile) {
            markBackup();
            const kb = Math.max(1, Math.round(size / 1024));
            const skipped = describeSkippedAttachments(attachments);
            if (oversize) { toast.warning("Auto-backup zapisany, ale jest za duży do wczytania", { description: BACKUP_OVERSIZE_NOTE, duration: 20000 }); return; }
            // Codzienny zapis do pliku jest cichy — komunikat tylko, gdy kopia pominęła załączniki.
            if (skipped) toast.success("Auto-backup zapisany", { description: `${filename} • ${kb} KB • ${count} notatek — ${skipped}`, duration: 14000 });
            return;
          }
          // Plik wybrany, ale przeglądarka cofnęła zgodę na zapis (wymaga kliknięcia) — prośba jak bez pliku.
          if (!isBackupDue(latest.current.prefs.autoExportDays, oldest())) return;
          toast("Czas na backup", {
            id: "auto-backup",
            description: last
              ? `Minęło ${latest.current.prefs.autoExportDays} dni od ostatniego. Pobierz plik z ${count} ${count === 1 ? "notatką" : "notatkami"}.`
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
      });
    }, 2500);

    // QL-2: schowanie aplikacji (koniec sesji) — cichy zapis do wybranego pliku, gdy od ostatniej kopii minął dzień.
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      void withLockIfFree(AUTO_BACKUP_LOCK, async () => {
        if (!(await hasBackupFile()) || !isBackupDue(FILE_BACKUP_DAYS, oldest())) return;
        try {
          const { exportFullBackup } = await loadExport();
          if ((await exportFullBackup(undefined, { allowDownload: false })).savedToFile) markBackup();
        } catch { /* następna próba przy kolejnym schowaniu albo otwarciu */ }
      });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => { clearTimeout(t); document.removeEventListener("visibilitychange", onHide); };
  }, [prefs.autoExportDays, latest]);

  // Backup reminder: nudge if last backup is older than reminderDays
  useEffect(() => {
    // Pusta baza (np. pierwsze uruchomienie) nie ma czego backupować.
    if (!isBackupDue(prefs.backupReminderDays, oldestCreatedAt(notes, archivedNotes))) return;
    if (sessionStorage.getItem(DANE.backupNudge) === "1") return;
    // Auto-backup w tej sesji już o to poprosił — drugi toast o tym samym to szum.
    if (sessionStorage.getItem(DANE.autoBackupDone) === "1") return;
    sessionStorage.setItem(DANE.backupNudge, "1");
    const t = setTimeout(() => {
      // Moduł z wyprzedzeniem: „Zrób backup” ma ruszyć od razu, w geście użytkownika.
      void loadExport();
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
              const { savedToFile } = await (await loadExport()).exportFullBackup();
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
