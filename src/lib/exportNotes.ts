import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { filledPropEntries, type PropDef } from "@/lib/noteProps";
import { isValidMeta } from "@/lib/vault";
// Schematy (zod) ładują się dopiero przy imporcie/backupie — nie ma ich w startowym bundlu.
import type { FullBackup } from "@/lib/noteSchema";
const loadSchemas = () => import("@/lib/noteSchema");
import { tryWriteBackupToFile } from "@/lib/backupFileHandle";
import { versionsStore } from "@/lib/versionsStore";
import { logDiag } from "@/lib/diagnostics";
import { imageStore, isEmbeddableImageDataUrl } from "@/lib/imageStore";
import { journalImageRefs } from "@/lib/study/images";
import { recordingRefsIn, siteDocRefsIn } from "@/lib/study/journalRefs";
import { STUDY_STORAGE_KEY } from "@/lib/study/keys";
import { extraSchedulesDump, mainShiftData, restoreExtraSchedule, restoreShifts, shiftsReady } from "@/lib/shifts/store";
import { migrate } from "@/lib/shifts/model";
import { BACKUP_ATTACHMENTS_BUDGET_BYTES, formatFileSize, type Attachment } from "@/lib/attachments";
import { PUSH_PREFS_KEY, type PushPrefs } from "@/lib/push/prefs";

const PUSH_RESTORE_KEY = PUSH_PREFS_KEY;

/**
 * Przywracanie ustawień push: adres serwera zostaje, a push się wyłącza (subskrypcja i
 * „ostatnio wysłane” należą do przeglądarki, na której była kopia — nie do nowego telefonu).
 */
function pushPrefsForRestore(raw: string): string {
  try {
    const p = JSON.parse(raw) as Partial<PushPrefs>;
    const off = Array.isArray(p.off) ? p.off.filter((x): x is string => typeof x === "string") : [];
    return JSON.stringify({ server: typeof p.server === "string" ? p.server : "", enabled: false, off });
  } catch {
    return JSON.stringify({ server: "", enabled: false, off: [] });
  }
}

/**
 * Granica plików: na zewnątrz obrazy jadą jako data URL-e (plik ma działać
 * samodzielnie, także w starszej wersji aplikacji). Obraz, którego to
 * urządzenie nie ma, zostaje kluczem — referencja nie ginie.
 */
export async function withEmbeddedImages(notes: Note[]): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => (n.images.length ? { ...n, images: await imageStore.resolve(n.images) } : n)));
}

/** Odwrotnie: data URL-e z pliku → `imageStore`, w notatkach zostają klucze. */
export async function withStoredImages(notes: Note[]): Promise<Note[]> {
  return Promise.all(notes.map(async (n) => (n.images.length ? { ...n, images: await imageStore.ingest(n.images) } : n)));
}

/** Do Markdown/HTML/PDF: tylko obrazy, które da się osadzić. */
export async function embeddableImages(images: string[]): Promise<string[]> {
  return (await imageStore.resolve(images)).filter(isEmbeddableImageDataUrl);
}

export async function exportToJSON(notes: Note[], filename?: string): Promise<{ filename: string; size: number }> {
  const data = JSON.stringify(await withEmbeddedImages(notes), null, 2);
  const name = filename || `kaczy-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
}

/** Załączniki, których bajtów nie ma w pliku backupu — do ostrzeżenia dla użytkownika. */
export interface BackupAttachmentReport {
  /** Pominięte, bo przekroczyłyby budżet rozmiaru backupu. */
  tooLarge: Attachment[];
  /** Manifest jest, ale bajtów nie ma na tym urządzeniu (np. plik dodany na innym). */
  missing: Attachment[];
  /** Zdjęcia dziennika z budowy, które nie weszły do backupu (budżet albo brak bajtów). */
  journalPhotos: number;
  /** Pliki budów (plany, PDF), które nie weszły do backupu — osobno od zdjęć. */
  siteDocs: number;
  /** Nagrania głosowe z wpisów, które nie weszły do backupu — osobno od zdjęć (U8). */
  recordings: number;
}

/** Zdanie do toastu o pominiętych załącznikach; `null`, gdy wszystko weszło. */
export function describeSkippedAttachments(r?: BackupAttachmentReport): string | null {
  if (!r) return null;
  const n = r.tooLarge.length + r.missing.length;
  const photos = r.journalPhotos;
  const docs = r.siteDocs;
  if (!n && !photos && !docs && !r.recordings) return null;
  const photosPart = photos ? `Pominięte zdjęcia dziennika z budowy: ${photos} — zostaną tylko na tym urządzeniu.` : null;
  const docsPart = docs ? `Pominięte pliki budów (plany, PDF): ${docs} — zostaną tylko na tym urządzeniu.` : null;
  const recPart = r.recordings ? `Pominięte nagrania głosowe: ${r.recordings} — zostaną tylko na tym urządzeniu.` : null;
  const extra = [photosPart, docsPart, recPart].filter(Boolean).join(" ") || null;
  if (!n) return extra;
  const parts: string[] = [];
  if (r.tooLarge.length) parts.push(`${r.tooLarge.length} za duże na backup (limit ${formatFileSize(BACKUP_ATTACHMENTS_BUDGET_BYTES)} na wszystkie pliki)`);
  if (r.missing.length) parts.push(`${r.missing.length} nieobecne na tym urządzeniu`);
  const main = `Pominięte załączniki: ${parts.join(", ")}. Zostaną w notatkach jako wpisy bez zawartości.`;
  return extra ? `${main} ${extra}` : main;
}

/** Bajty załączników do backupu v3 w ramach budżetu; najpierw mniejsze, żeby weszło ich jak najwięcej. */
async function collectAttachmentBlobs(budget: number): Promise<{ blobs: Record<string, string>; report: BackupAttachmentReport }> {
  const report: BackupAttachmentReport = { tooLarge: [], missing: [], journalPhotos: 0, siteDocs: 0, recordings: 0 };
  const blobs: Record<string, string> = {};
  let used = 0;
  const all = [...yjsStore.referencedAttachments().values()].sort((a, b) => a.size - b.size);
  for (const a of all) {
    if (used + a.size > budget) { report.tooLarge.push(a); continue; }
    const dataUrl = await imageStore.getDataUrl(a.hash);
    if (!dataUrl) { report.missing.push(a); continue; }
    blobs[a.hash] = dataUrl;
    used += a.size;
  }
  // Zdjęcia dziennika z budowy: te same bajty co w `imageStore`, razem z załącznikami w budżecie.
  const docs = siteDocRefsIn(yjsStore.doc);
  const recordings = recordingRefsIn(yjsStore.doc);
  // Każdy pominięty bajt liczony w swojej kategorii: plik budowy, nagranie albo zdjęcie dziennika.
  const skip = (hash: string) => {
    if (docs.has(hash)) report.siteDocs++;
    else if (recordings.has(hash)) report.recordings++;
    else report.journalPhotos++;
  };
  for (const hash of journalImageRefs()) {
    if (blobs[hash]) continue;
    const dataUrl = await imageStore.getDataUrl(hash);
    // Wcześniej pomijane po cichu — użytkownik myślał, że zdjęcia z budowy są w kopii.
    if (!dataUrl) { skip(hash); continue; }
    const approx = Math.ceil(dataUrl.length * 0.75);
    if (used + approx > budget) { skip(hash); continue; }
    blobs[hash] = dataUrl;
    used += approx;
  }
  return { blobs, report };
}

/** Zawartość pełnego backupu v3 (bez zapisu do pliku) + raport o pominiętych załącznikach. */
export async function buildFullBackupWithReport(opts: { attachmentBudget?: number } = {}): Promise<{ backup: FullBackup; attachments: BackupAttachmentReport }> {
  await yjsStore.ready();
  await versionsStore.load();
  await shiftsReady();
  // Dane działu Praca ładowane dopiero tu — nie wchodzą do paczki startowej.
  const [{ studyReady, yStudy }, { stateFromDump }, { supplementDump: supplementsDump }, { dietDump }, { trainingDump }, { debtsDump }, { entryCheckDump }] = await Promise.all([import("@/lib/study/data"), import("@/lib/study/yStudy"), import("@/lib/supplements/store"), import("@/lib/diet/store"), import("@/lib/training/store"), import("@/lib/debts/store"), import("@/lib/study/entryCheckStore")]);
  await studyReady();
  const { blobs, report } = await collectAttachmentBlobs(opts.attachmentBudget ?? BACKUP_ATTACHMENTS_BUDGET_BYTES);
  const study = yStudy.dump();
  const propDefs = yjsStore.projectPropDefs();
  const backup: FullBackup = {
    version: 3,
    exportedAt: Date.now(),
    // Notatki prywatne są w projekcji puste i niosą tylko szyfrogram (`vault`).
    notes: await withEmbeddedImages(yjsStore.projectNotes()),
    // Sól i klucz danych opakowany hasłem — bez hasła (albo kodu awaryjnego) nic z tego nie odczyta treści.
    ...(yjsStore.getVaultMeta() ? { vault: yjsStore.getVaultMeta() } : {}),
    labels: yjsStore.projectLabels(),
    folders: yjsStore.projectFolders(),
    // Bez definicji nie ma sekcji — kopia bez właściwości wygląda jak dawniej.
    ...(propDefs.length ? { propDefs } : {}),
    versions: versionsStore.all(),
    // Nauka także w dawnym kształcie, wśród ustawień — starsze wersje aplikacji ją odczytają.
    settings: { ...readKeys(SETTINGS_KEYS), [STUDY_STORAGE_KEY]: JSON.stringify(stateFromDump(study)) },
    achievements: readKeys([ACHIEVEMENTS_KEY])[ACHIEVEMENTS_KEY],
    // Ten sam JSON co dawny zapis w localStorage — starsze wersje aplikacji go odczytają.
    // Grafik główny w `shifts` (jak dawniej, starsze wersje go odczytają); pozostałe grafiki osobno.
    shifts: JSON.stringify(mainShiftData()),
    ...(extraSchedulesDump().length ? { shiftSchedules: JSON.stringify(extraSchedulesDump()) } : {}),
    study: JSON.stringify(study),
    // Odżywki i odhaczenia w osobnej sekcji; scalane przy przywracaniu, bez kasowania (stara kopia bez niej działa dalej).
    supplements: JSON.stringify(supplementsDump()),
    diet: JSON.stringify(dietDump()),
    training: JSON.stringify(trainingDump()),
    // Długi: pożyczki są w dokumencie Yjs, więc bez tej sekcji kopia by je gubiła.
    debts: JSON.stringify(debtsDump()),
    // Lista przed wejściem na budowę (punkty i odhaczenia dni) — osobna mapa, scalana przy przywracaniu.
    entryCheck: JSON.stringify(entryCheckDump()),
    ...(Object.keys(blobs).length ? { attachmentBlobs: blobs } : {}),
    // Same liczby (bez treści) — okno przywracania mówi, czego w pliku nie ma; zera = nic nie pominięto.
    skipped: { tooLarge: report.tooLarge.length, missing: report.missing.length, journalPhotos: report.journalPhotos, siteDocs: report.siteDocs, recordings: report.recordings },
  };
  return { backup, attachments: report };
}

export async function buildFullBackup(): Promise<FullBackup> {
  return (await buildFullBackupWithReport()).backup;
}

/**
 * Pełny backup: notatki + etykiety + foldery, wystarczający do odtworzenia całej bazy.
 * Jeśli w Ustawieniach wybrano jeden, zapamiętany plik (File System Access API,
 * desktop Chrome/Edge), nadpisuje go zamiast pobierać kolejny plik do Pobranych.
 */
export async function exportFullBackup(
  filename?: string,
  { allowDownload = true, confirm }: { allowDownload?: boolean; confirm?: (report: BackupAttachmentReport) => Promise<boolean> } = {},
): Promise<{ filename: string; size: number; savedToFile: boolean; downloaded: boolean; attachments: BackupAttachmentReport; cancelled: boolean }> {
  const { backup, attachments } = await buildFullBackupWithReport();
  // D3: gdy kopia pominie załączniki, pytamy przed zapisem (kopia jest już zbudowana, nic nie buduje się drugi raz).
  if (confirm && describeSkippedAttachments(attachments) && !(await confirm(attachments))) {
    return { filename: "", size: 0, savedToFile: false, downloaded: false, attachments, cancelled: true };
  }
  const data = JSON.stringify(backup, null, 2);
  const name = filename || `kaczy-full-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  const savedToFile = await tryWriteBackupToFile(data);
  // Pobranie bez gestu użytkownika przeglądarki blokują albo o nie pytają —
  // auto-backup przekazuje `allowDownload: false` i prosi o kliknięcie.
  const downloaded = !savedToFile && allowDownload;
  if (downloaded) download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size, savedToFile, downloaded, attachments, cancelled: false };
}

// Załączniki (do 40 MB surowych, ~53 MB jako base64) mieszczą się obok notatek i obrazów.
const MAX_IMPORT_FILE_SIZE = 120 * 1024 * 1024; // 120 MB

/**
 * Ustawienia wchodzące do pełnego backupu. Świadomie **bez** `kaczy.sync.v1`
 * (kod parowania to sekret, a na nowym urządzeniu paruje się od nowa) i bez
 * znaczników „kiedy ostatnio przypominano”.
 */
export const SETTINGS_KEYS = [
  "kaczy.viewPrefs.v1", "kaczy-theme", "kaczy.motion.v1", "kaczy.confirmPrefs.v1",
  "kaczy.effectsSettings.v1", "kaczy.seasonTheme.v1", "kaczy.templates.v1", "kaczy.skin.v1", "kaczy.siteMode.v1", "kaczy.font.v1",
  // Dzień przeglądu, odznaka, auto-blokada skarbca — zwykłe preferencje, bez sekretów.
  "kaczy:review.day", "kaczy:badge.enabled", "kaczy.vault.autolock.v1",
  // Flagi funkcji w przygotowaniu (src/lib/featureFlags.ts) — zwykłe przełączniki.
  "kaczy.features.v1",
  // Push: wpis jest, ale przy przywracaniu push wyłączamy (patrz `PUSH_RESTORE_KEY`) — subskrypcja jest na urządzeniu.
  PUSH_RESTORE_KEY,
];
export const ACHIEVEMENTS_KEY = "kaczy.achievements.v1";

function readKeys(keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) {
    try { const v = localStorage.getItem(k); if (v !== null) out[k] = v; } catch { /* ignore */ }
  }
  return out;
}

/** Wybór i walidacja pliku pełnego backupu — jeszcze bez żadnych zmian w danych. */
export function pickFullBackup(): Promise<FullBackup> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error("Nie wybrano pliku"));
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        return reject(new Error(`Plik jest zbyt duży (max ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} MB)`));
      }
      try {
        resolve(await parseFullBackup(await file.text()));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik backupu"));
      }
    };
    input.click();
  });
}

export async function parseFullBackup(text: string): Promise<FullBackup> {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).notes)) {
    throw new Error("To nie jest plik pełnego backupu aplikacji NOTKI");
  }
  const { fullBackupSchema } = await loadSchemas();
  return fullBackupSchema.parse(raw);
}

export interface RestoreOptions { versions: boolean; settings: boolean; achievements: boolean; shifts: boolean; study: boolean }

/**
 * Przywraca backup: notatki, foldery i etykiety zawsze (destrukcyjnie),
 * pozostałe sekcje tylko zaznaczone i obecne w pliku. Ustawienia działają
 * po przeładowaniu strony, które i tak następuje po przywróceniu.
 */
/** Wynik przywracania: ile wpisów Nauki odrzucono przy czyszczeniu kopii (0 = wszystko przeszło). */
/** L1: w dzienniku diagnostycznym zostaje tylko nazwa błędu — komunikat `JSON.parse` może zawierać fragment kopii. */
const errName = (e: unknown): string => (e instanceof Error ? e.name : "błąd");

export async function restoreFullBackup(backup: FullBackup, opts: RestoreOptions): Promise<{ studyDropped: number; schedulesSkipped: number }> {
  let studyDropped = 0;
  let schedulesSkipped = 0;
  await yjsStore.ready();
  // Obrazy i załączniki najpierw: błąd zapisu (brak miejsca) przerywa przed destrukcyjnym replaceAll.
  const notes = await withStoredImages(backup.notes);
  if (backup.attachmentBlobs) await imageStore.ingest(Object.values(backup.attachmentBlobs));
  yjsStore.replaceAll(notes, backup.folders, backup.labels, backup.propDefs ?? []);
  if (backup.supplements) {
    try {
      const { mergeSupplementDump } = await import("@/lib/supplements/store");
      mergeSupplementDump(JSON.parse(backup.supplements));
    } catch (err) { logDiag("warn", "backup", "cannot restore supplements", errName(err)); }
  }
  if (backup.diet) {
    try {
      const { mergeDietDump } = await import("@/lib/diet/store");
      mergeDietDump(JSON.parse(backup.diet));
    } catch (err) { logDiag("warn", "backup", "cannot restore diet", errName(err)); }
  }
  if (backup.training) {
    try {
      const { mergeTrainingDump } = await import("@/lib/training/store");
      // Notatki z kopii są już wczytane (wyżej), więc można sprawdzić, czy przypomnienie ma swoją notatkę.
      mergeTrainingDump(JSON.parse(backup.training), (id) => yjsStore.projectNotes().some((n) => n.id === id));
    } catch (err) { logDiag("warn", "backup", "cannot restore training", errName(err)); }
  }
  if (backup.debts) {
    try {
      const { mergeDebtsDump } = await import("@/lib/debts/store");
      mergeDebtsDump(JSON.parse(backup.debts));
    } catch (err) { logDiag("warn", "backup", "cannot restore debts", errName(err)); }
  }
  // Lista przed wejściem: scalanie bez kasowania; uszkodzona sekcja po prostu się pomija.
  if (backup.entryCheck) await import("@/lib/study/entryCheckStore").then((m) => m.mergeEntryCheckDump(JSON.parse(backup.entryCheck!))).catch(() => {});
  // Metadane skarbca z pliku: bez nich zablokowane notatki z backupu byłyby nie do odszyfrowania.
  if (isValidMeta(backup.vault)) yjsStore.setVaultMeta(backup.vault);
  if (opts.versions && backup.versions) {
    await versionsStore.load();
    versionsStore.replaceAll(backup.versions);
    await versionsStore.flush();
  }
  const writes: Record<string, string> = {};
  if (opts.settings && backup.settings) {
    for (const k of SETTINGS_KEYS) {
      if (!(k in backup.settings)) continue;
      writes[k] = k === PUSH_RESTORE_KEY ? pushPrefsForRestore(backup.settings[k]) : backup.settings[k];
    }
  }
  if (opts.achievements && backup.achievements !== undefined) writes[ACHIEVEMENTS_KEY] = backup.achievements;
  if (opts.shifts && backup.shifts !== undefined) {
    try {
      await shiftsReady();
      const raw = JSON.parse(backup.shifts);
      // M8: bez pola `bonuses` (kopia sprzed premii) premie z tego telefonu zostają.
      restoreShifts(migrate(raw), Array.isArray(raw?.bonuses));
    } catch (err) { logDiag("warn", "backup", "cannot restore shifts", errName(err)); }
    // M4: dodatkowe grafiki — każdy osobno; odrzucone (limit, zły id, zły kształt) są liczone i zgłaszane.
    try {
      const extra = backup.shiftSchedules ? JSON.parse(backup.shiftSchedules) as { id: string; name: string; data: unknown }[] : [];
      for (const s of Array.isArray(extra) ? extra : []) {
        try {
          if (typeof s?.id !== "string" || typeof s?.name !== "string" || !restoreExtraSchedule(s.id, s.name, migrate(s.data))) schedulesSkipped++;
        } catch (err) { schedulesSkipped++; logDiag("warn", "backup", "cannot restore schedule", errName(err)); }
      }
    } catch (err) { logDiag("warn", "backup", "cannot read schedules", errName(err)); }
    if (schedulesSkipped) logDiag("warn", "backup", `przywracanie grafików: pominięto ${schedulesSkipped}`);
  }
  const legacyStudy = backup.settings?.[STUDY_STORAGE_KEY];
  if (opts.study && (backup.study !== undefined || legacyStudy !== undefined)) {
    try {
      const [{ studyDevice, studyReady, yStudy }, { cleanDump, dumpFromLegacy }] = await Promise.all([import("@/lib/study/data"), import("@/lib/study/yStudy")]);
      await studyReady();
      // Starsze kopie niosą Naukę tylko wśród ustawień, w kształcie dawnego zapisu.
      const raw = backup.study !== undefined ? JSON.parse(backup.study) : null;
      const dump = raw !== null ? cleanDump(raw) : dumpFromLegacy(JSON.parse(legacyStudy!), studyDevice());
      // Wpisy nieznanego rodzaju albo z uszkodzonymi polami odpadają przy czyszczeniu — zostawiamy ślad, zamiast gubić je po cichu.
      const rawCount = raw && Array.isArray(raw.journal) ? raw.journal.length : dump.journal.length;
      if (rawCount > dump.journal.length) {
        studyDropped = rawCount - dump.journal.length;
        logDiag("warn", "backup", `przywracanie Nauki: pominięto ${studyDropped} wpisów`);
      }
      yStudy.replaceAll(dump);
    } catch (err) { logDiag("warn", "backup", "cannot restore study", errName(err)); }
  }
  for (const [k, v] of Object.entries(writes)) {
    try { localStorage.setItem(k, v); } catch (err) { logDiag("warn", "backup", `cannot restore ${k}`, err); }
  }
  return { studyDropped, schedulesSkipped };
}

export function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToMarkdown(notes: Note[], propDefs: PropDef[] = []) {
  const lines: string[] = [];
  lines.push(`# NOTKI — eksport`);
  lines.push(`> ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl })}`);
  lines.push("");

  // Notatki prywatne nie trafiają do eksportu tekstowego (jawny plik) — jest ich tylko liczba.
  const privateCount = notes.filter((n) => n.locked).length;
  for (const note of notes) {
    if (note.locked) continue;
    if (note.title) lines.push(`## ${note.title}`);
    if (note.labels.length) lines.push(`*Etykiety: ${note.labels.join(", ")}*`);
    if (note.reminder) lines.push(`*Przypomnienie: ${format(new Date(note.reminder), "d MMM yyyy, HH:mm", { locale: pl })}*`);
    const fields = filledPropEntries(propDefs, note.props);
    if (fields.length) lines.push(`*${fields.map(([name, text]) => `${name}: ${text}`).join(" · ")}*`);
    if (note.content) lines.push("", note.content);
    if (note.checklist?.length) {
      lines.push("");
      note.checklist.forEach((item) => {
        lines.push(`${item.indent ? "  " : ""}- [${item.checked ? "x" : " "}] ${item.text}`);
      });
    }
    const images = await embeddableImages(note.images ?? []);
    if (images.length) {
      lines.push("");
      images.forEach((img, i) => lines.push(`![obraz ${i + 1}](${img})`));
    }
    if (note.attachments?.length) {
      // Pliki zostają w aplikacji — eksport tekstowy tylko o nich informuje.
      lines.push("", `*Załączniki (pliki nie są częścią eksportu): ${note.attachments.map((a) => `${a.name} (${formatFileSize(a.size)})`).join(", ")}*`);
    }
    lines.push("", "---", "");
  }

  if (privateCount) lines.push(`*Pominięto notatki prywatne: ${privateCount}. Są tylko w pełnym backupie, jako szyfrogram.*`, "");
  download(lines.join("\n"), "kaczy-export.md", "text/markdown");
}

export async function exportToHTML(notes: Note[]) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dateStr = format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl });

  let html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NOTKI — eksport</title>
<style>
body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;background:#fafafa;color:#1a1a1a}
h1{font-size:1.8rem;margin-bottom:.2rem}
.date{color:#888;font-size:.85rem;margin-bottom:2rem}
.note{background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:1.2rem;margin-bottom:1rem}
.note h2{margin:0 0 .5rem;font-size:1.1rem}
.labels{font-size:.8rem;color:#888;font-style:italic}
.reminder{font-size:.8rem;color:#b45309;font-style:italic}
.content{margin:.6rem 0;white-space:pre-wrap;line-height:1.6}
.checklist{list-style:none;padding:0}
.checklist li{padding:2px 0}
.checked{text-decoration:line-through;color:#999}
.images{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.5rem;margin-top:.6rem}
.images img{width:100%;border-radius:8px;display:block}
</style>
</head>
<body>
<h1>NOTKI</h1>
<p class="date">Eksport: ${escape(dateStr)}</p>
`;

  const privateCount = notes.filter((n) => n.locked).length;
  for (const note of notes) {
    if (note.locked) continue;
    html += `<div class="note">`;
    if (note.title) html += `<h2>${escape(note.title)}</h2>`;
    if (note.labels.length) html += `<p class="labels">Etykiety: ${escape(note.labels.join(", "))}</p>`;
    if (note.reminder) html += `<p class="reminder">Przypomnienie: ${escape(format(new Date(note.reminder), "d MMM yyyy, HH:mm", { locale: pl }))}</p>`;
    if (note.content) html += `<div class="content">${escape(note.content)}</div>`;
    if (note.checklist?.length) {
      html += `<ul class="checklist">`;
      note.checklist.forEach((item) => {
        html += `<li class="${item.checked ? "checked" : ""}">${item.checked ? "☑" : "☐"} ${escape(item.text)}</li>`;
      });
      html += `</ul>`;
    }
    const images = await embeddableImages(note.images ?? []);
    if (images.length) {
      html += `<div class="images">`;
      images.forEach((img) => { html += `<img src="${escape(img).replace(/"/g, "&quot;")}" alt="">`; });
      html += `</div>`;
    }
    if (note.attachments?.length) {
      html += `<p class="labels">Załączniki (pliki nie są częścią eksportu): ${escape(note.attachments.map((a) => `${a.name} (${formatFileSize(a.size)})`).join(", "))}</p>`;
    }
    html += `</div>\n`;
  }

  if (privateCount) html += `<p class="labels">Pominięto notatki prywatne: ${privateCount}.</p>\n`;
  html += `</body></html>`;
  download(html, "kaczy-export.html", "text/html");
}

export function importFromJSON(): Promise<Note[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return reject(new Error("Nie wybrano pliku"));
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        return reject(new Error(`Plik jest zbyt duży (max ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)} MB)`));
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const { noteSchema, looksLikeNoteArray } = await loadSchemas();
        if (!looksLikeNoteArray(data)) throw new Error("Nieprawidłowy format — oczekiwano listy notatek");
        resolve(await withStoredImages(data.map((n) => noteSchema.parse(n))));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik"));
      }
    };
    input.click();
  });
}
