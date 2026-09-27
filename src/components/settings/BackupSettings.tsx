import { useEffect, useState } from "react";
import { Download, Database, ShieldCheck, ShieldAlert, FileCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { exportFullBackup, importFullBackup } from "@/lib/exportNotes";
import { daysSinceBackup } from "@/lib/backupReminder";
import { requestPersistentStorage, getStorageInfo, type StorageInfo } from "@/lib/storagePersistence";
import { isFileSystemAccessSupported, pickBackupFile, clearBackupFile, getBackupFileName } from "@/lib/backupFileHandle";
import { toast } from "sonner";
import { Section } from "./SettingsShared";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "?";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    if (granted) toast.success("Przeglądarka obiecała nie czyścić danych KACZY automatycznie");
    else toast.error("Przeglądarka nie przyznała trwałego storage — spróbuj dodać appkę do ekranu głównego/zakładek");
  }

  if (!info) return null;

  return (
    <Section title="Trwałość danych w tej przeglądarce">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs space-y-2">
        <div className="flex items-center gap-2">
          {info.persisted ? (
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
          )}
          <p className="text-foreground">
            {info.persisted
              ? "Przeglądarka nie będzie automatycznie czyścić danych KACZY pod presją miejsca."
              : "Przeglądarka MOŻE automatycznie wyczyścić dane KACZY, gdy zabraknie miejsca na dysku — to jedyna kopia notatek, jeśli nie robisz backupów."}
          </p>
        </div>
        <p className="text-muted-foreground">
          Zajęte: {formatBytes(info.usageBytes)} {info.quotaBytes !== null && `z ${formatBytes(info.quotaBytes)} dostępnych`}
        </p>
        {!info.persisted && (
          <Button size="sm" variant="outline" onClick={handleRequest} disabled={requesting} className="w-full">
            Poproś przeglądarkę o trwały storage
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
      toast.success("Backupy będą teraz nadpisywać ten plik zamiast pobierać nowe");
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
              ? <>Backupy nadpisują <span className="font-semibold">{fileName}</span> zamiast pobierać nowy plik.</>
              : "Domyślnie każdy backup to nowy plik w Pobranych. Możesz zamiast tego wskazać jeden plik, który będzie nadpisywany."}
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
    try { localStorage.removeItem("kaczy.lastAutoExport"); } catch { /* ignore */ }
  }
}

async function exportNow() {
  try {
    const { savedToFile } = await exportFullBackup();
    try { localStorage.setItem("kaczy.lastAutoExport", String(Date.now())); } catch { /* ignore */ }
    toast.success(savedToFile ? "Backup zapisany 💾" : "Backup pobrany 💾");
  } catch {
    toast.error("Nie udało się wygenerować backupu");
  }
}

async function restoreNow() {
  try {
    const backup = await importFullBackup();
    toast.success(`Backup wczytany — ${backup.notes.length} notatek. Odświeżam…`);
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    if (err instanceof Error && err.message !== "Nie wybrano pliku") {
      toast.error("Nie udało się wczytać backupu: " + err.message);
    }
  }
}

/** "Dane" tab: auto-backup, backup/today/week reminders, manual export/import. */
export function BackupSettings() {
  const prefs = useViewPrefs();

  return (
    <div className="space-y-4">
      <StoragePersistenceStatus />
      <BackupFileTarget />

      <Section title={`Auto-backup ${prefs.autoExportDays === 0 ? "(wyłączony)" : `co ${prefs.autoExportDays} dni`}`}>
        <Slider
          value={[prefs.autoExportDays]}
          min={0} max={30} step={1}
          onValueChange={([v]) => handleAutoExportChange(v)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Po przekroczeniu interwału aplikacja sama zapisze backup (gdy otworzysz KACZY) — do Pobranych, albo do jednego wybranego pliku, jeśli go ustawiłeś niżej.
        </p>
      </Section>

      <Section title={`Przypomnienie ${prefs.backupReminderDays === 0 ? "(wyłączone)" : `co ${prefs.backupReminderDays} dni`}`}>
        <Slider
          value={[prefs.backupReminderDays]}
          min={0} max={60} step={1}
          onValueChange={([v]) => setViewPref("backupReminderDays", v)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {(() => {
            const d = daysSinceBackup();
            if (d === null) return "Jeszcze nie zrobiłeś backupu.";
            return `Ostatni backup: ${d === 0 ? "dziś" : `${d} dni temu`}.`;
          })()}
        </p>
      </Section>

      <Section title={`Przypomnienie „Dziś” ${prefs.todayReminderTime ? `codziennie o ${prefs.todayReminderTime}` : prefs.todayReminderHours === 0 ? "(wyłączone)" : prefs.todayReminderHours >= 24 ? `co ${Math.round(prefs.todayReminderHours / 24)} dni` : `co ${prefs.todayReminderHours} h`}`}>
        <Slider
          value={[prefs.todayReminderHours]}
          min={0} max={48} step={1}
          onValueChange={([v]) => setViewPref("todayReminderHours", v)}
          disabled={!!prefs.todayReminderTime}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground shrink-0">albo o stałej godzinie:</span>
          <input
            type="time"
            value={prefs.todayReminderTime}
            onChange={(e) => setViewPref("todayReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.todayReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("todayReminderTime", "")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >wyczyść</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {prefs.todayReminderTime
            ? `Toast pojawi się raz dziennie o ${prefs.todayReminderTime} (gdy masz notatki z dzisiaj).`
            : prefs.todayReminderHours === 0
              ? "Powiadomienie o notatkach z dzisiaj nie będzie się pojawiać."
              : `Toast pojawi się co najwyżej raz na ${prefs.todayReminderHours} ${prefs.todayReminderHours === 1 ? "godzinę" : prefs.todayReminderHours < 5 ? "godziny" : "godzin"} (gdy masz notatki z dzisiaj).`}
        </p>
      </Section>

      <Section title={`Przypomnienie „Ten tydzień” ${prefs.weekReminderTime ? `${["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][prefs.weekReminderDay]} o ${prefs.weekReminderTime}` : "(wyłączone)"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={prefs.weekReminderDay}
            onChange={(e) => setViewPref("weekReminderDay", Number(e.target.value))}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
            disabled={!prefs.weekReminderTime}
          >
            {["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"].map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <input
            type="time"
            value={prefs.weekReminderTime}
            onChange={(e) => setViewPref("weekReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.weekReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("weekReminderTime", "")}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >wyłącz</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {prefs.weekReminderTime
            ? "Raz w tygodniu, o wybranej porze, dostaniesz podsumowanie ostatnich 7 dni."
            : "Ustaw godzinę, aby otrzymywać cotygodniowe przypomnienie."}
        </p>
      </Section>

      <Button onClick={exportNow} className="w-full gap-2">
        <Download className="w-4 h-4" /> Pobierz pełny backup teraz
      </Button>
      <Button onClick={restoreNow} variant="outline" className="w-full gap-2">
        <Database className="w-4 h-4" /> Przywróć z pliku backupu
      </Button>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Wskazówka</p>
        <p>Pełny backup zawiera wszystkie notatki (w tym archiwum i kosz), etykiety i foldery. Przywrócenie z pliku zastąpi obecne dane w tej przeglądarce i odświeży aplikację.</p>
      </div>
    </div>
  );
}
