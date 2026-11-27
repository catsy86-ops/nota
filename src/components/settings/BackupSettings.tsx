import { SiteStorageSettings } from "./SiteStorageSettings";
import { yjsStore } from "@/lib/yjsStore";
import { ignoreDocFormat, useDocFormatStatus } from "@/lib/docFormat";
import { StudyUsageStats } from "./StudyUsageStats";
import { useEffect, useState } from "react";
import { Download, Database, ShieldCheck, ShieldAlert, FileCog, FileDown, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref, VIEW_PREF_GROUPS } from "@/lib/viewPrefs";
import { buildFullBackup, describeSkippedAttachments } from "@/lib/backup/build";
import { backupIssues, describeBackupIssues } from "@/lib/backup/parse";
import { restoreFullBackup, RestoreCheckError, restoreScope, type RestoreOptions } from "@/lib/backup/merge";
import { backupPreview, describeBackupPreview } from "@/lib/backup/preview";
import { imageStore } from "@/lib/imageStore";
import { download, pickFullBackup } from "@/lib/backup/download";
import { describeBackupSkipped } from "@/lib/backupSkipped";
import { dniPl, pluralPl } from "@/lib/plural";
import type { FullBackup } from "@/lib/noteSchema";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { daysSinceBackup, LAST_AUTO_EXPORT_KEY } from "@/lib/backupReminder";
import { requestPersistentStorage, getStorageInfo, storageBreakdown, storageWarning, type StorageBreakdown, type StorageInfo } from "@/lib/storagePersistence";
import { isFileSystemAccessSupported, pickBackupFile, clearBackupFile, getBackupFileName, readLastFileWrite } from "@/lib/backupFileHandle";
import { toast } from "sonner";
import { ResetSectionButton, Section } from "./SettingsShared";
import { LastImportUndo } from "./LastImportUndo";
import { canShareBackupFile, exportNow, shareNow, type SkipConfirm } from "@/lib/backup/actions";
import { UnusedFilesCleanup } from "./UnusedFilesCleanup";
import { AboutPanel } from "@/components/AboutPanel";
import { SecurityLogPanel } from "./SecurityLogPanel";
import { ErrorLogPanel } from "./ErrorLogPanel";
import { viewLabel } from "@/lib/viewMeta";
import { DailySnapshotRestore } from "./DailySnapshotRestore";
import { inSyncGroup, saveCurrentLocally } from "@/lib/docReplace";
import { listDailySnapshots, readSnapshotStatus, unpinDailySnapshot, SNAPSHOT_LAST_KEY, type SnapshotEntry } from "@/lib/dailySnapshot";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PRACA } from "@/lib/storage/names";

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
  // U3.3: podział liczony na żądanie — czyta każdy plik z magazynu, na telefonie z setkami zdjęć to chwila.
  const [split, setSplit] = useState<StorageBreakdown | "busy" | null>(null);

  useEffect(() => {
    getStorageInfo().then(setInfo);
  }, []);

  async function handleSplit() {
    setSplit("busy");
    try {
      const [files, fresh] = await Promise.all([imageStore.totalBytes(), getStorageInfo()]);
      setInfo(fresh);
      setSplit(storageBreakdown(fresh.usageBytes ?? files.bytes, files.bytes, fresh.cachesBytes));
    } catch {
      setSplit(null);
      toast.error("Nie udało się policzyć zajętego miejsca");
    }
  }

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
      <div className={cn(cardVariant("inset"), "p-3 text-xs space-y-2")}>
        <div className="flex items-center gap-2">
          {info.persisted ? (
            <ShieldCheck className="size-4 text-success-ink shrink-0" />
          ) : (
            <ShieldAlert className="size-4 text-warning-ink shrink-0" />
          )}
          <p className="text-foreground">
            {info.persisted
              ? "Przeglądarka nie będzie automatycznie czyścić danych aplikacji pod presją miejsca."
              : "Przeglądarka może sama wyczyścić dane aplikacji, gdy zabraknie miejsca na dysku — to jedyna kopia notatek, jeśli nie robisz innych kopii."}
          </p>
        </div>
        <p className="text-muted-foreground">
          Zajęte: {formatBytes(info.usageBytes)} {info.quotaBytes !== null && `z ${formatBytes(info.quotaBytes)} dostępnych`}
          {split && split !== "busy" && (
            <span data-testid="storage-split">
              {" "}(zdjęcia i pliki {formatBytes(split.files)}, notatki i pozostałe dane {formatBytes(split.data)}{split.app !== undefined && `, pliki aplikacji ${formatBytes(split.app)}`})
            </span>
          )}
        </p>
        {split === null && (
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleSplit()} className="-ml-2 h-auto min-h-8 px-2 py-1 text-xs coarse:min-h-11">
            Pokaż, co zajmuje miejsce
          </Button>
        )}
        {split === "busy" && <p className="text-muted-foreground" role="status">Liczę zdjęcia i pliki…</p>}
        {storageWarning(info) && (
          <p role="alert" className="text-warning-ink">{storageWarning(info)}</p>
        )}
        <DailySnapshotHealth />
        {!info.persisted && (
          <Button size="sm" variant="outline" onClick={handleRequest} disabled={requesting} className="h-auto min-h-9 w-full whitespace-normal py-2 coarse:min-h-11">
            Poproś przeglądarkę o trwałe przechowywanie
          </Button>
        )}
      </div>
    </Section>
  );
}

/** Dni lokalne od chwili `at` do dziś: 0 = dziś. */
function daysAgo(at: number): number {
  const a = new Date(at);
  const b = new Date();
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime() - new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86_400_000);
}

const whenLabel = (at: number) => {
  const d = daysAgo(at);
  return d <= 0 ? "dziś" : d === 1 ? "wczoraj" : `${dniPl(d)} temu`;
};

const notesLabel = (n: number) => `${n} ${pluralPl(n, ["notatka", "notatki", "notatek"])}`;

/** Wiersz „Kopia dzienna” w karcie trwałości (Q1.4): tylko z `localStorage`, bez czytania OPFS. */
function DailySnapshotHealth() {
  const status = readSnapshotStatus();
  if (!status || status.result === "unsupported") return null;
  const today = daysAgo(status.at) === 0;
  if (today && status.result === "quota") {
    return <p role="alert" className="text-warning-ink">Kopia dzienna nie zapisana — brak miejsca. Starsze kopie dzienne zostały.</p>;
  }
  if (today && status.result === "error") {
    return <p role="alert" className="text-warning-ink">Dzisiejsza kopia dzienna nie zapisała się. Szczegóły są w raporcie diagnostycznym niżej.</p>;
  }
  let last: { date: number; notes: number } | null = null;
  try { last = JSON.parse(localStorage.getItem(SNAPSHOT_LAST_KEY) ?? "null"); } catch { /* brak */ }
  if (!last || typeof last.date !== "number") return null;
  const unchanged = today && status.result === "unchanged" && daysAgo(last.date) > 0;
  return (
    <p className="text-muted-foreground">
      Kopia dzienna: {whenLabel(last.date)}, {notesLabel(last.notes)}.{unchanged && " Od tamtej pory bez zmian, więc dziś nowej nie trzeba."}
    </p>
  );
}

/**
 * Kopie dzienne w OPFS (Q1.4, Z-16.1 część A): lista z datą, liczbą notatek, rozmiarem i stanem pliku.
 * Bez OPFS (tryb prywatny, stara przeglądarka) sekcji nie ma. Przywracanie — część B.
 */
function DailySnapshots() {
  const [list, setList] = useState<SnapshotEntry[] | null | undefined>(undefined);
  const [restoreFrom, setRestoreFrom] = useState<SnapshotEntry | null>(null);
  const load = () => { listDailySnapshots().then(setList, () => setList(null)); };
  useEffect(load, []);
  if (!list) return null;

  async function unpin() {
    let ok = false;
    try { ok = await unpinDailySnapshot(); } catch { /* jak niżej */ }
    load();
    if (ok) toast.success("Odpięto — ta kopia zniknie, gdy wypadnie z 7 ostatnich dni");
    else toast.error("Nie udało się odpiąć kopii dziennej. Spróbuj jeszcze raz.");
  }

  return (
    <Section title="Kopie dzienne na tym urządzeniu">
      <p className="ui-hint mb-2">
        Raz dziennie aplikacja zapisuje stan wszystkich danych poza główną bazą przeglądarki. Zostaje 7 ostatnich dni ze zmianami. Bez zdjęć, załączników i historii wersji. „Wyczyść dane witryny” usuwa też te kopie, więc nie zastępują kopii do pliku.
      </p>
      {list.length === 0 ? (
        <p className="ui-hint">Pierwsza kopia dzienna powstanie pół minuty po otwarciu aplikacji.</p>
      ) : (
        <ul className={cn(cardVariant("inset"), "divide-y divide-border/60 text-xs")} aria-label="Kopie dzienne">
          {list.map((e) => (
            <li key={e.ref} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium text-foreground tabular-nums">{new Date(e.createdAt).toLocaleDateString("pl-PL")}</span>
              {e.kind === "before" && <span className="text-muted-foreground">sprzed przywrócenia, {new Date(e.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>}
              <span className="text-muted-foreground tabular-nums">
                {e.notes !== null && `${notesLabel(e.notes)} · `}{formatBytes(e.bytes)}
              </span>
              {e.state === "broken" && <span className="text-warning-ink">uszkodzona</span>}
              {e.state === "newer" && <span className="text-warning-ink">zapisana przez nowszą wersję aplikacji</span>}
              {e.state === "ok" && (
                <Button type="button" size="sm" variant="outline" className={e.pinned ? "" : "ml-auto"} onClick={() => setRestoreFrom(e)}
                  aria-label={`Przywróć notatki z kopii ${e.kind === "before" ? "sprzed przywrócenia, " : "z "}${new Date(e.createdAt).toLocaleDateString("pl-PL")}`}>
                  Przywróć…
                </Button>
              )}
              {e.pinned && (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-foreground">przypięta</span>
                  <Button type="button" size="sm" variant="outline" onClick={unpin}>Odepnij</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {restoreFrom && (
        <DailySnapshotRestore snapshotRef={restoreFrom.ref} createdAt={restoreFrom.createdAt} open onOpenChange={(o) => { if (!o) setRestoreFrom(null); }} />
      )}
      {list.some((e) => e.pinned) && (
        <p className="ui-hint mt-1.5">Przypięta kopia jest sprzed dnia, w którym ubyło ponad połowę notatek. Nie znika z 7 ostatnimi dniami, dopóki jej nie odepniesz.</p>
      )}
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
    const ok = await pickBackupFile(`notki-kopia-${new Date().toISOString().slice(0, 10)}.json`);
    if (ok) {
      setFileName(await getBackupFileName());
      toast.success("Kopie będą teraz nadpisywać ten plik zamiast pobierać nowe");
    }
  }

  async function handleForget() {
    await clearBackupFile();
    setFileName(null);
    toast("Kopia wróci do pobierania nowego pliku za każdym razem");
  }

  if (!loaded) return null;

  return (
    <Section title="Miejsce zapisu kopii">
      <div className={cn(cardVariant("inset"), "p-3 text-xs space-y-2")}>
        <div className="flex items-center gap-2">
          <FileCog className="size-4 text-muted-foreground shrink-0" />
          <p className="text-foreground">
            {fileName
              ? <>Kopie nadpisują <span className="font-semibold">{fileName}</span> zamiast pobierać nowy plik. Kopia zapisuje się tam sama raz dziennie — przy otwarciu albo schowaniu aplikacji. Każdy zapis zastępuje poprzedni; starsze stany są w kopiach dziennych wyżej.</>
              : "Domyślnie każda kopia to nowy plik w Pobranych. Możesz zamiast tego wskazać jeden plik, który będzie nadpisywany — wtedy każda kolejna kopia, także automatyczna, zastąpi poprzednią, a starsze przepadną."}
          </p>
        </div>
        {fileName && <LastFileWrite />}
        {fileName ? (
          <Button size="sm" variant="outline" onClick={handleForget} className="w-full">Wróć do pobierania nowego pliku</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={handlePick} className="w-full">Wybierz jeden plik do nadpisywania</Button>
        )}
      </div>
    </Section>
  );
}

/** QL-2: kiedy i ile ostatnio zapisano do wybranego pliku. */
function LastFileWrite() {
  const last = readLastFileWrite();
  if (!last) return <p className="ui-meta" data-testid="backup-file-last">Jeszcze nie zapisano do tego pliku.</p>;
  const when = new Date(last.at).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const size = last.bytes >= 1024 * 1024 ? `${(last.bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(last.bytes / 1024))} KB`;
  return <p className="ui-meta tabular-nums" data-testid="backup-file-last">Ostatni zapis: {when} · {size}</p>;
}

function handleAutoExportChange(v: number) {
  setViewPref("autoExportDays", v);
  if (v === 0) {
    try { localStorage.removeItem(LAST_AUTO_EXPORT_KEY); } catch { /* ignore */ }
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
  // Z-18.1: uszkodzone części wykryte przed zapisem — pytanie „Przywróć bez nich / Anuluj”.
  const [broken, setBroken] = useState<string[] | null>(null);
  const [savedCurrent, setSavedCurrent] = useState(false);
  // Z-18.3: bez kopii w OPFS pytamy, czy pobrany plik się zapisał; przy synchronizacji osobne potwierdzenie (D-A1).
  const [askSaved, setAskSaved] = useState<string[] | null>(null);
  const [syncAsk, setSyncAsk] = useState<string[] | null>(null);
  const [syncOk, setSyncOk] = useState(false);
  // Z-16.2: postęp wymiany notatek i „Przerwij”.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [abort, setAbort] = useState<AbortController | null>(null);

  async function pick() {
    try {
      setBackup(await pickFullBackup());
      setOpts({ versions: true, settings: true, achievements: true, shifts: true, study: true });
      setSavedCurrent(false);
      setSyncOk(false);
      setBroken(null);
    } catch (err) {
      if (err instanceof Error && err.message !== "Nie wybrano pliku") {
        toast.error("Nie udało się wczytać kopii: " + err.message);
      }
    }
  }

  async function restore(skip: string[] = [], { fileConfirmed = false, syncConfirmed = syncOk } = {}) {
    if (!backup) return;
    setBroken(null);
    // D-A1: przy sparowanych urządzeniach osobne potwierdzenie, zanim cokolwiek się zmieni.
    if (!syncConfirmed && inSyncGroup()) { setSyncAsk(skip); return; }
    setBusy(true);
    try {
      // Najpierw kopia tego, co jest teraz — przywrócenie nadpisuje dane. Raz na plik kopii. P5 audytu 2 (Z-18.3):
      // droga powrotu to kopia w OPFS sprawdzona po zapisie; pobranie pliku nie mówi, czy się udało, więc bez OPFS
      // pytamy wprost, czy plik się zapisał.
      if (!savedCurrent && !fileConfirmed) {
        let local = false;
        try { await saveCurrentLocally(); local = true; } catch { /* bez OPFS albo błąd zapisu — plik i pytanie */ }
        try {
          const current = await buildFullBackup();
          download(JSON.stringify(current), `notki-przed-przywroceniem-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
        } catch (err) {
          if (!local) {
            setBusy(false);
            toast.error("Nie zapisałem kopii sprzed przywrócenia, więc przywracanie wstrzymane" + (err instanceof Error ? ": " + err.message : ""));
            return;
          }
        }
        if (!local) { setBusy(false); setAskSaved(skip); return; }
        setSavedCurrent(true);
      }
      if (fileConfirmed) setSavedCurrent(true);
      const ctrl = new AbortController();
      setAbort(ctrl);
      const { studyDropped, schedulesSkipped, failed } = await restoreFullBackup(backup, { ...opts, skip }, {
        signal: ctrl.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      const notes: string[] = [];
      if (studyDropped > 0) notes.push(`Pominięto ${studyDropped} ${pluralPl(studyDropped, ["wpis Nauki", "wpisy Nauki", "wpisów Nauki"])} o nieznanym kształcie`);
      if (schedulesSkipped > 0) notes.push(`Nie przywrócono ${schedulesSkipped} ${pluralPl(schedulesSkipped, ["grafiku", "grafików", "grafików"])} (limit albo zły plik)`);
      if (failed.length > 0) notes.push(`Nie udało się przywrócić: ${failed.join(", ")}`);
      // Przy pominiętych danych dajemy czas na przeczytanie komunikatu przed odświeżeniem.
      // Błąd sekcji to nie „Przywrócono”: ostrzeżenie zamiast sukcesu (W8).
      (failed.length > 0 ? toast.warning : toast.success)(`${failed.length > 0 ? "Przywrócono kopię z błędami" : "Przywrócono kopię"} — ${backup.notes.length} notatek, odświeżam stronę…`,
        notes.length ? { description: `${notes.join(". ")} — ślad jest w diagnostyce.`, duration: 8000 } : undefined);
      setTimeout(() => window.location.reload(), notes.length ? 6000 : 1200);
    } catch (err) {
      setBusy(false);
      setProgress(null);
      setAbort(null);
      if (err instanceof DOMException && err.name === "AbortError") {
        toast.info("Przerwano. Notatki dodane z kopii zostają, nic nie zostało usunięte.");
        setBackup(null);
        return;
      }
      // Nic jeszcze nie zapisano — pytamy, czy przywrócić bez uszkodzonych części.
      if (err instanceof RestoreCheckError) { setBroken(err.sections); return; }
      toast.error("Nie udało się przywrócić kopii" + (err instanceof Error ? ": " + err.message : ""));
    }
  }

  const sections: { key: Exclude<keyof RestoreOptions, "skip">; label: string; present: boolean }[] = backup ? [
    { key: "versions", label: `Historia wersji (${backup.versions?.length ?? 0})`, present: backup.versions !== undefined },
    { key: "settings", label: "Ustawienia (wygląd, styl, efekty, potwierdzenia)", present: backup.settings !== undefined },
    { key: "achievements", label: "Odznaki i passa", present: backup.achievements !== undefined },
    { key: "shifts", label: viewLabel("shifts"), present: backup.shifts !== undefined },
    { key: "study", label: "Praca i dziennik z budowy", present: backup.study !== undefined || backup.settings?.[PRACA.store] !== undefined },
  ] : [];

  return (
    <>
      <Button onClick={pick} variant="outline" className="w-full gap-2">
        <Database className="size-4" /> Przywróć z pliku kopii
      </Button>
      <AlertDialog open={!!backup} onOpenChange={(o) => { if (!o && !busy) setBackup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić tę kopię?</AlertDialogTitle>
            <AlertDialogDescription>
              {backup && <span data-testid="restore-preview">
                Z {new Date(backup.exportedAt).toLocaleString("pl-PL")}{backup.appVersion ? ` (wersja aplikacji ${backup.appVersion})` : ""}: {describeBackupPreview(backupPreview(backup))}.{" "}
              </span>}
              {backup && (() => {
                const { replaced, merged } = restoreScope(backup as never, opts);
                return <>
                  <span data-testid="restore-replaced">Zastąpione zawartością pliku: {replaced.join(", ")}.</span>
                  {merged.length > 0 && <span data-testid="restore-merged"> Uzupełnione o brakujące: {merged.join(", ")}.</span>}
                  {" "}Obecne dane zapiszę najpierw jako kopię sprzed przywrócenia.
                </>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {backup && describeBackupSkipped(backup.skipped) && (
              <p className="text-sm text-warning-ink" data-testid="restore-skipped">{describeBackupSkipped(backup.skipped)}</p>
            )}
            {backup && describeBackupIssues(backupIssues(backup)).map((line) => (
              <p key={line} className="text-sm text-warning-ink" data-testid="restore-issues">{line}</p>
            ))}
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
          {backup && opts.study && (
            <p className="ui-hint" data-testid="restore-money-note">
              Rozliczenia, wpłaty, zlecenia, punkty wodne, zestawy i materiał w aucie są <strong>scalane</strong>: to, co już masz na tym telefonie, zostaje,
              a kopia dokłada tylko brakujące wartości. Stare stawki i wpłaty z kopii nie nadpiszą nowszych.
            </p>
          )}
          {busy && progress && progress.total > 0 && (
            <div role="status" className="space-y-1 text-sm" data-testid="restore-progress">
              <p>Przywracanie notatek: {progress.done} z {progress.total}</p>
              <progress className="h-1.5 w-full" max={progress.total} value={progress.done} aria-label="Postęp przywracania" />
            </div>
          )}
          <AlertDialogFooter>
            {busy && abort ? (
              <Button type="button" variant="outline" onClick={() => abort.abort()}>Przerwij</Button>
            ) : (
              <AlertDialogCancel disabled={busy}>Anuluj</AlertDialogCancel>
            )}
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={busy} onClick={(e) => { e.preventDefault(); void restore(); }}>Przywróć kopię</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={syncAsk !== null} onOpenChange={(o) => { if (!o) setSyncAsk(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmiana obejmie wszystkie sparowane urządzenia</AlertDialogTitle>
            <AlertDialogDescription>
              To urządzenie jest w grupie synchronizacji. Zastąpione dane zmienią się też na pozostałych urządzeniach,
              a to, co ktoś dopisał tam po zrobieniu tej kopii, zniknie wszędzie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { const skip = syncAsk ?? []; setSyncAsk(null); setSyncOk(true); void restore(skip, { syncConfirmed: true }); }}>Przywróć na wszystkich</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={askSaved !== null} onOpenChange={(o) => { if (!o) setAskSaved(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy plik się zapisał?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta przeglądarka nie ma miejsca na kopię wewnątrz aplikacji, więc obecne dane poszły do pliku
              „notki-przed-przywroceniem-…”. Sprawdź w Pobranych, czy jest — to jedyna droga powrotu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Nie, wstrzymaj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { const skip = askSaved ?? []; setAskSaved(null); void restore(skip, { fileConfirmed: true, syncConfirmed: true }); }}>Tak, przywróć</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={broken !== null} onOpenChange={(o) => { if (!o) setBroken(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Część kopii jest uszkodzona</AlertDialogTitle>
            <AlertDialogDescription>
              Nie da się odczytać: {broken?.join(", ")}. Nic jeszcze nie zostało zmienione. Możesz przywrócić kopię bez tych części
              — dane z nich zostaną takie, jak są teraz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => void restore(broken ?? [], { fileConfirmed: savedCurrent })}>Przywróć bez nich</AlertDialogAction>
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
      <DailySnapshots />
      <BackupFileTarget />
      <LastImportUndo />
      <UnusedFilesCleanup />

      <Section title={`Kopia automatyczna ${prefs.autoExportDays === 0 ? "(wyłączony)" : `co ${dniPl(prefs.autoExportDays)}`}`}>
        <Slider
          value={[prefs.autoExportDays]}
          min={0} max={30} step={1}
          aria-label="Kopia automatyczna: co ile dni"
          onValueChange={([v]) => handleAutoExportChange(v)}
        />
        <p className="ui-hint mt-1.5">
          Z plikiem wybranym wyżej kopia zapisuje się sama raz dziennie. Bez niego po tym czasie pojawi się przycisk „Pobierz” — przeglądarki nie pozwalają pobierać plików bez kliknięcia. Pozycja „wyłączony” wyłącza też zapis do pliku.
        </p>
      </Section>

      <Section title={`Przypomnienie ${prefs.backupReminderDays === 0 ? "(wyłączone)" : `co ${dniPl(prefs.backupReminderDays)}`}`}>
        <Slider
          value={[prefs.backupReminderDays]}
          min={0} max={60} step={1}
          aria-label="Przypomnienie o kopii: co ile dni"
          onValueChange={([v]) => setViewPref("backupReminderDays", v)}
        />
        <p className="ui-hint mt-1.5">
          {(() => {
            const d = daysSinceBackup();
            if (d === null) return "Nie ma jeszcze kopii.";
            return `Ostatnia kopia: ${d === 0 ? "dziś" : `${dniPl(d)} temu`}.`;
          })()}
        </p>
      </Section>

      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox
          className="mt-0.5"
          checked={prefs.backupPlanImages}
          onCheckedChange={(v) => setViewPref("backupPlanImages", !!v)}
        />
        <span>
          Obrazy planów w kopii
          <span className="block text-xs text-muted-foreground">Plik kopii nie jest szyfrowany. Bez obrazów analizy planów zostają w kopii, a same rysunki tylko na urządzeniach.</span>
        </span>
      </label>

      <Button onClick={() => exportNow(askSkip)} className="w-full gap-2">
        <Download className="size-4" /> Pobierz pełną kopię teraz
      </Button>
      {canShareBackupFile() && (
        <Button variant="outline" onClick={() => shareNow(askSkip)} className="w-full gap-2">
          <Share2 className="size-4" /> Wyślij kopię
        </Button>
      )}
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
      <SiteStorageSettings />

      <Section title="Przywracanie z kopii">
        <RestoreBackup />
      </Section>

      <ResetSectionButton title="kopia" keys={VIEW_PREF_GROUPS.kopia} />

      <div className={cn(cardVariant("inset"), "p-3 text-xs text-muted-foreground space-y-1")}>
        <p className="font-semibold text-foreground">💡 Wskazówka</p>
        <p>Pełna kopia zawiera wszystkie notatki (w tym archiwum i kosz), etykiety, foldery, historię wersji, ustawienia oraz odznaki. Nie zawiera kodu parowania urządzeń. Przywrócenie zastąpi notatki w tej przeglądarce i odświeży aplikację.</p>
      </div>

      <Section title="O aplikacji">
        <AboutPanel />
      </Section>

      <Section title="Zdarzenia bezpieczeństwa">
        <SecurityLogPanel />
      </Section>

      <Section title="Diagnostyka">
        <div className={cn(cardVariant("inset"), "flex items-center justify-between gap-4 px-4 py-3")}>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Raport diagnostyczny</p>
            <p className="ui-hint mt-0.5">
              Plik tekstowy z wersją aplikacji, stanem pamięci i synchronizacji oraz ostatnimi błędami. Bez treści notatek i bez kodu parowania. Nic nie jest wysyłane.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDownloadReport} className="shrink-0 gap-1.5">
            <FileDown className="size-3.5" />Pobierz
          </Button>
        </div>
        <div className="space-y-2 px-1">
          <p className="text-sm font-semibold">Błędy na tym urządzeniu</p>
          <ErrorLogPanel />
        </div>
        <DocFormatOverride />
        <StudyUsageStats />
      </Section>
    </div>
  );
}

/**
 * D1.3: „Ignoruj i pisz” — tylko gdy dokument wymaga nowszej wersji. Wymaganie mógł wpisać ktoś znający kod
 * synchronizacji, żeby zablokować zapis; obejście zostaje na tym urządzeniu.
 */
function DocFormatOverride() {
  const status = useDocFormatStatus(yjsStore.doc as never);
  if (status.tooNew.length === 0) return null;
  return (
    <div className={cn(cardVariant("status", "warning"), "flex items-center justify-between gap-4 bg-warning/10 px-4 py-3")} data-testid="doc-format-override">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Dane wymagają nowszej wersji</p>
        <p className="ui-hint mt-0.5">
          {status.tooNew.map((f) => `${f.feature} (wersja ${f.required})`).join(", ")}. Najpierw zaktualizuj aplikację. Obejście tylko wtedy, gdy nikt w grupie nie ma nowszej wersji — wtedy wymaganie wpisał ktoś obcy.
        </p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => ignoreDocFormat(!status.ignored)} className="shrink-0">
        {status.ignored ? "Przywróć blokadę" : "Ignoruj i pisz"}
      </Button>
    </div>
  );
}
