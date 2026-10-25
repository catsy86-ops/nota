import { useEffect, useState } from "react";
import { Download, Database, ShieldCheck, ShieldAlert, FileCog, FileDown } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref, VIEW_PREF_GROUPS } from "@/lib/viewPrefs";
import { buildFullBackup, describeSkippedAttachments, download, exportFullBackup, pickFullBackup, restoreFullBackup, type BackupAttachmentReport, type RestoreOptions } from "@/lib/exportNotes";
import { describeBackupSkipped } from "@/lib/backupSkipped";
import { dniPl } from "@/lib/plural";
import type { FullBackup } from "@/lib/noteSchema";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { daysSinceBackup, LAST_AUTO_EXPORT_KEY } from "@/lib/backupReminder";
import { requestPersistentStorage, getStorageInfo, type StorageInfo } from "@/lib/storagePersistence";
import { isFileSystemAccessSupported, pickBackupFile, clearBackupFile, getBackupFileName } from "@/lib/backupFileHandle";
import { toast } from "sonner";
import { ResetSectionButton, Section } from "./SettingsShared";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "?";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const oneDecimal = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  if (bytes < 1024 ** 3) return `${oneDecimal(bytes / 1024 ** 2)} MB`;
  return `${oneDecimal(bytes / 1024 ** 3)} GB`;
}

/** "Czy przeglądarka może same wyczyścić dane" status + jednorazowa prośba o trwałość. */
function StoragePersistenceStatus() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    getStorageInfo().then(setInfo);
  }, []);

  async function handleRequest() {
    setRequesting(true);
    const granted = await requestPersistentStorage();
    const fresh = await getStorageInfo();
    setInfo(fresh);
    setRequesting(false);
    if (granted) toast.success("Przeglądarka obiecała nie czyścić danych aplikacji automatycznie");
    else toast.error("Przeglądarka nie przyznała trwałego storage — spróbuj dodać appkę do ekranu głównego/zakładek");
  }

  if (!info) return null;

  return (
    <Section title="Trwałość danych w tej przeglądarce">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          {info.persisted ? (
            <ShieldCheck className="w-4 h-4 text-success-ink shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-warning-ink shrink-0" />
          )}
          <p className="text-foreground">
            {info.persisted
              ? "Przeglądarka nie będzie automatycznie czyścić danych aplikacji pod presją miejsca."
              : "Przeglądarka może sama wyczyścić dane aplikacji, gdy zabraknie miejsca na dysku — to jedyna kopia notatek, jeśli nie robisz backupów."}
          </p>
        </div>
        <p className="text-muted-foreground">
          Zajęte: {formatBytes(info.usageBytes)} {info.quotaBytes !== null && `z ${formatBytes(info.quotaBytes)} dostępnych`}
        </p>
        {!info.persisted && (
          <Button size="sm" variant="outline" onClick={handleRequest} disabled={requesting} className="w-full">
            Poproś przeglądarkę o trwałe przechowywanie
          </Button>
        )}
      </div>
    </Section>
  );
}

/**
 * Desktop Chrome/Edge only: remember one file on disk that every future
 * backup overwrites, instead of a fresh download landing in Pobrane each
 * time (auto-backup every N days adds up to dozens of files over a year).
 */
function BackupFileTarget() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getBackupFileName().then((name) => { setFileName(name); setLoaded(true); });
  }, []);

  if (!isFileSystemAccessSupported()) return null;

  async function handlePick() {
    const ok = await pickBackupFile(`kaczy-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
    if (ok) {
      setFileName(await getBackupFileName());
      toast.success("Kopie będą teraz nadpisywać ten plik zamiast pobierać nowe");
    }
  }

  async function handleForget() {
    await clearBackupFile();
    setFileName(null);
    toast("Backup wróci do pobierania nowego pliku za każdym razem");
  }

  if (!loaded) return null;

  return (
    <Section title="Miejsce zapisu backupu">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          <FileCog className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-foreground">
            {fileName
              ? <>Kopie nadpisują <span className="font-semibold">{fileName}</span> zamiast pobierać nowy plik. Każdy kolejny backup, także automatyczny, zastępuje poprzedni — starszych kopii w tym pliku nie będzie.</>
              : "Domyślnie każdy backup to nowy plik w Pobranych. Możesz zamiast tego wskazać jeden plik, który będzie nadpisywany — wtedy każdy kolejny backup, także automatyczny, zastąpi poprzedni, a starsze kopie przepadną."}
          </p>
        </div>
        {fileName ? (
          <Button size="sm" variant="outline" onClick={handleForget} className="w-full">Wróć do pobierania nowego pliku</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handlePick} className="w-full">Wybierz jeden plik do nadpisywania</Button>
        )}
      </div>
    </Section>
  );
}

function handleAutoExportChange(v: number) {
  setViewPref("autoExportDays", v);
  if (v === 0) {
    try { localStorage.removeItem(LAST_AUTO_EXPORT_KEY); } catch { /* ignore */ }
  }
}

/** D3: pytanie, gdy kopia pominie załączniki. Zwraca `true`, gdy użytkownik chce zapisać mimo to. */
type SkipConfirm = (report: BackupAttachmentReport) => Promise<boolean>;

async function exportNow(confirm: SkipConfirm) {
  try {
    const res = await exportFullBackup(undefined, { confirm });
    if (res.cancelled) return;
    const { savedToFile, attachments } = res;
    try { localStorage.setItem(LAST_AUTO_EXPORT_KEY, String(Date.now())); } catch { /* ignore */ }
    const skipped = describeSkippedAttachments(attachments);
    toast.success(savedToFile ? "Backup zapisany 💾" : "Backup pobrany 💾", skipped ? { description: skipped, duration: 12000 } : undefined);
  } catch {
    toast.error("Nie udało się wygenerować backupu");
  }
}

/**
 * Przywracanie w dwóch krokach: najpierw plik jest tylko czytany, potem
 * użytkownik widzi, co w nim jest, i wybiera sekcje poza notatkami.
 */
function RestoreBackup() {
  const [backup, setBackup] = useState<FullBackup | null>(null);
  const [opts, setOpts] = useState<RestoreOptions>({ versions: true, settings: true, achievements: true, shifts: true, study: true });
  const [busy, setBusy] = useState(false);

  async function pick() {
    try {
      setBackup(await pickFullBackup());
      setOpts({ versions: true, settings: true, achievements: true, shifts: true, study: true });
    } catch (err) {
      if (err instanceof Error && err.message !== "Nie wybrano pliku") {
        toast.error("Nie udało się wczytać backupu: " + err.message);
      }
    }
  }

  async function restore() {
    if (!backup) return;
    setBusy(true);
    try {
      // Najpierw kopia tego, co jest teraz — przywrócenie nadpisuje dane, a ten plik jest drogą powrotu.
      try {
        const current = await buildFullBackup();
        download(JSON.stringify(current), `kaczy-przed-przywroceniem-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
      } catch (err) {
        setBusy(false);
        toast.error("Nie zapisałem kopii sprzed przywrócenia, więc przywracanie wstrzymane" + (err instanceof Error ? ": " + err.message : ""));
        return;
      }
      const { studyDropped, schedulesSkipped } = await restoreFullBackup(backup, opts);
      const notes: string[] = [];
      if (studyDropped > 0) notes.push(`Pominięto ${studyDropped} ${studyDropped === 1 ? "wpis Nauki" : "wpisy Nauki"} o nieznanym kształcie`);
      if (schedulesSkipped > 0) notes.push(`Nie przywrócono ${schedulesSkipped} ${schedulesSkipped === 1 ? "grafiku" : "grafików"} (limit albo zły plik)`);
      // Przy pominiętych danych dajemy czas na przeczytanie komunikatu przed odświeżeniem.
      toast.success(`Backup przywrócony — ${backup.notes.length} notatek. Odświeżam…`,
        notes.length ? { description: `${notes.join(". ")} — ślad jest w diagnostyce.`, duration: 8000 } : undefined);
      setTimeout(() => window.location.reload(), notes.length ? 6000 : 1200);
    } catch (err) {
      setBusy(false);
      toast.error("Nie udało się przywrócić backupu" + (err instanceof Error ? ": " + err.message : ""));
    }
  }

  const sections: { key: keyof RestoreOptions; label: string; present: boolean }[] = backup ? [
    { key: "versions", label: `Historia wersji (${backup.versions?.length ?? 0})`, present: backup.versions !== undefined },
    { key: "settings", label: "Ustawienia (wygląd, motyw, efekty, potwierdzenia)", present: backup.settings !== undefined },
    { key: "achievements", label: "Odznaki i passa", present: backup.achievements !== undefined },
    { key: "shifts", label: "Grafik zmian", present: backup.shifts !== undefined },
    { key: "study", label: "Praca i dziennik z budowy", present: backup.study !== undefined || backup.settings?.["kaczy.study.v1"] !== undefined },
  ] : [];

  return (
    <>
      <Button onClick={pick} variant="outline" className="w-full gap-2">
        <Database className="w-4 h-4" /> Przywróć z pliku backupu
      </Button>
      <AlertDialog open={!!backup} onOpenChange={(o) => { if (!o && !busy) setBackup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić ten backup?</AlertDialogTitle>
            <AlertDialogDescription>
              {backup && <>Z {new Date(backup.exportedAt).toLocaleString("pl-PL")}: {backup.notes.length} notatek, {backup.folders.length} folderów. </>}
              Notatki, foldery i etykiety w tej przeglądarce zostaną zastąpione zawartością pliku. Przy sparowanych urządzeniach
              zmiany zrobione w międzyczasie na innych urządzeniach mogą przepaść — zrób wcześniej kopię bieżącego stanu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {backup && describeBackupSkipped(backup.skipped) && (
              <p className="text-sm text-warning-ink" data-testid="restore-skipped">{describeBackupSkipped(backup.skipped)}</p>
            )}
            {sections.map((sec) => (
              <label key={sec.key} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox
                  checked={sec.present && opts[sec.key]}
                  disabled={!sec.present}
                  onCheckedChange={(v) => setOpts((o) => ({ ...o, [sec.key]: !!v }))}
                />
                <span className={sec.present ? "" : "text-muted-foreground"}>
                  {sec.label}{!sec.present && " — brak w tym pliku"}
                </span>
              </label>
            ))}
          </div>
          {backup && opts.study && backup.study !== undefined && (
            <p className="text-sm text-warning-ink" data-testid="restore-study-warning">
              Praca i dziennik z budowy z tego pliku zastąpią też dane na sparowanych urządzeniach, nie tylko tutaj.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={busy} onClick={(e) => { e.preventDefault(); void restore(); }}>Przywróć backup</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

async function handleDownloadReport() {
  try {
    const { downloadDiagReport } = await import("@/lib/diagnosticsReport");
    await downloadDiagReport();
  } catch {
    toast.error("Nie udało się przygotować raportu");
  }
}

/** "Kopia i dane" tab: auto-backup, backup/today/week reminders, manual export/import. */
export function BackupSettings() {
  const prefs = useViewPrefs();
  const [skipPrompt, setSkipPrompt] = useState<{ text: string; resolve: (ok: boolean) => void } | null>(null);
  const askSkip: SkipConfirm = (report) => new Promise<boolean>((resolve) => {
    setSkipPrompt({ text: describeSkippedAttachments(report) ?? "", resolve: (ok) => { setSkipPrompt(null); resolve(ok); } });
  });

  return (
    <div className="space-y-4">
      <StoragePersistenceStatus />
      <BackupFileTarget />

      <Section title={`Auto-backup ${prefs.autoExportDays === 0 ? "(wyłączony)" : `co ${dniPl(prefs.autoExportDays)}`}`}>
        <Slider
          value={[prefs.autoExportDays]}
          min={0} max={30} step={1}
          aria-label="Auto-backup: co ile dni"
          onValueChange={([v]) => handleAutoExportChange(v)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Po przekroczeniu interwału (gdy otworzysz aplikację) backup sam zapisze się do pliku wybranego wyżej. Bez wybranego pliku pojawi się przycisk „Pobierz” — przeglądarki nie pozwalają pobierać plików bez kliknięcia.
        </p>
      </Section>

      <Section title={`Przypomnienie ${prefs.backupReminderDays === 0 ? "(wyłączone)" : `co ${dniPl(prefs.backupReminderDays)}`}`}>
        <Slider
          value={[prefs.backupReminderDays]}
          min={0} max={60} step={1}
          aria-label="Przypomnienie o kopii: co ile dni"
          onValueChange={([v]) => setViewPref("backupReminderDays", v)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {(() => {
            const d = daysSinceBackup();
            if (d === null) return "Nie ma jeszcze backupu.";
            return `Ostatni backup: ${d === 0 ? "dziś" : `${dniPl(d)} temu`}.`;
          })()}
        </p>
      </Section>

      <Button onClick={() => exportNow(askSkip)} className="w-full gap-2">
        <Download className="w-4 h-4" /> Pobierz pełny backup teraz
      </Button>
      <AlertDialog open={!!skipPrompt} onOpenChange={(o) => { if (!o) skipPrompt?.resolve(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kopia będzie niepełna</AlertDialogTitle>
            <AlertDialogDescription>
              {skipPrompt?.text} Zapisać kopię mimo to?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => skipPrompt?.resolve(false)}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => skipPrompt?.resolve(true)}>Zapisz mimo to</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Section title="Przywracanie z kopii">
        <RestoreBackup />
      </Section>

      <ResetSectionButton title="kopia" keys={VIEW_PREF_GROUPS.kopia} />

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Wskazówka</p>
        <p>Pełny backup zawiera wszystkie notatki (w tym archiwum i kosz), etykiety, foldery, historię wersji, ustawienia oraz odznaki. Nie zawiera kodu parowania urządzeń. Przywrócenie zastąpi notatki w tej przeglądarce i odświeży aplikację.</p>
      </div>

      <Section title="Diagnostyka">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Raport diagnostyczny</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plik tekstowy z wersją aplikacji, stanem pamięci i synchronizacji oraz ostatnimi błędami. Bez treści notatek i bez kodu parowania. Nic nie jest wysyłane.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDownloadReport} className="shrink-0 gap-1.5">
            <FileDown className="w-3.5 h-3.5" />Pobierz
          </Button>
        </div>
      </Section>
    </div>
  );
}
