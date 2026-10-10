import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { isValidMeta } from "@/lib/vault";
// Schematy (zod) ładują się dopiero przy imporcie/backupie — nie ma ich w startowym bundlu.
import type { FullBackup } from "@/lib/noteSchema";
const loadSchemas = () => import("@/lib/noteSchema");
import { tryWriteBackupToFile } from "@/lib/backupFileHandle";
import { versionsStore } from "@/lib/versionsStore";
import { logDiag } from "@/lib/diagnostics";
import { imageStore, isEmbeddableImageDataUrl } from "@/lib/imageStore";
import { restoreShifts, shiftStore, shiftsReady } from "@/lib/shifts/store";
import { migrate } from "@/lib/shifts/model";
import { BACKUP_ATTACHMENTS_BUDGET_BYTES, formatFileSize, type Attachment } from "@/lib/attachments";

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
}

/** Zdanie do toastu o pominiętych załącznikach; `null`, gdy wszystko weszło. */
export function describeSkippedAttachments(r?: BackupAttachmentReport): string | null {
  if (!r) return null;
  const n = r.tooLarge.length + r.missing.length;
  if (!n) return null;
  const parts: string[] = [];
  if (r.tooLarge.length) parts.push(`${r.tooLarge.length} za duże na backup (limit ${formatFileSize(BACKUP_ATTACHMENTS_BUDGET_BYTES)} na wszystkie pliki)`);
  if (r.missing.length) parts.push(`${r.missing.length} nieobecne na tym urządzeniu`);
  return `Pominięte załączniki: ${parts.join(", ")}. Zostaną w notatkach jako wpisy bez zawartości.`;
}

/** Bajty załączników do backupu v3 w ramach budżetu; najpierw mniejsze, żeby weszło ich jak najwięcej. */
async function collectAttachmentBlobs(): Promise<{ blobs: Record<string, string>; report: BackupAttachmentReport }> {
  const report: BackupAttachmentReport = { tooLarge: [], missing: [] };
  const blobs: Record<string, string> = {};
  let used = 0;
  const all = [...yjsStore.referencedAttachments().values()].sort((a, b) => a.size - b.size);
  for (const a of all) {
    if (used + a.size > BACKUP_ATTACHMENTS_BUDGET_BYTES) { report.tooLarge.push(a); continue; }
    const dataUrl = await imageStore.getDataUrl(a.hash);
    if (!dataUrl) { report.missing.push(a); continue; }
    blobs[a.hash] = dataUrl;
    used += a.size;
  }
  return { blobs, report };
}

/** Zawartość pełnego backupu v3 (bez zapisu do pliku) + raport o pominiętych załącznikach. */
export async function buildFullBackupWithReport(): Promise<{ backup: FullBackup; attachments: BackupAttachmentReport }> {
  await yjsStore.ready();
  await versionsStore.load();
  await shiftsReady();
  const { blobs, report } = await collectAttachmentBlobs();
  const backup: FullBackup = {
    version: 3,
    exportedAt: Date.now(),
    // Notatki prywatne są w projekcji puste i niosą tylko szyfrogram (`vault`).
    notes: await withEmbeddedImages(yjsStore.projectNotes()),
    // Sól i klucz danych opakowany hasłem — bez hasła (albo kodu awaryjnego) nic z tego nie odczyta treści.
    ...(yjsStore.getVaultMeta() ? { vault: yjsStore.getVaultMeta() } : {}),
    labels: yjsStore.projectLabels(),
    folders: yjsStore.projectFolders(),
    versions: versionsStore.all(),
    settings: readKeys(SETTINGS_KEYS),
    achievements: readKeys([ACHIEVEMENTS_KEY])[ACHIEVEMENTS_KEY],
    // Ten sam JSON co dawny zapis w localStorage — starsze wersje aplikacji go odczytają.
    shifts: JSON.stringify(shiftStore.get()),
    ...(Object.keys(blobs).length ? { attachmentBlobs: blobs } : {}),
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
  { allowDownload = true }: { allowDownload?: boolean } = {},
): Promise<{ filename: string; size: number; savedToFile: boolean; downloaded: boolean; attachments: BackupAttachmentReport }> {
  const { backup, attachments } = await buildFullBackupWithReport();
  const data = JSON.stringify(backup, null, 2);
  const name = filename || `kaczy-full-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  const savedToFile = await tryWriteBackupToFile(data);
  // Pobranie bez gestu użytkownika przeglądarki blokują albo o nie pytają —
  // auto-backup przekazuje `allowDownload: false` i prosi o kliknięcie.
  const downloaded = !savedToFile && allowDownload;
  if (downloaded) download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size, savedToFile, downloaded, attachments };
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
  "kaczy.effectsSettings.v1", "kaczy.seasonTheme.v1",
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

export interface RestoreOptions { versions: boolean; settings: boolean; achievements: boolean; shifts: boolean }

/**
 * Przywraca backup: notatki, foldery i etykiety zawsze (destrukcyjnie),
 * pozostałe sekcje tylko zaznaczone i obecne w pliku. Ustawienia działają
 * po przeładowaniu strony, które i tak następuje po przywróceniu.
 */
export async function restoreFullBackup(backup: FullBackup, opts: RestoreOptions): Promise<void> {
  await yjsStore.ready();
  // Obrazy i załączniki najpierw: błąd zapisu (brak miejsca) przerywa przed destrukcyjnym replaceAll.
  const notes = await withStoredImages(backup.notes);
  if (backup.attachmentBlobs) await imageStore.ingest(Object.values(backup.attachmentBlobs));
  yjsStore.replaceAll(notes, backup.folders, backup.labels);
  // Metadane skarbca z pliku: bez nich zablokowane notatki z backupu byłyby nie do odszyfrowania.
  if (isValidMeta(backup.vault)) yjsStore.setVaultMeta(backup.vault);
  if (opts.versions && backup.versions) {
    await versionsStore.load();
    versionsStore.replaceAll(backup.versions);
    await versionsStore.flush();
  }
  const writes: Record<string, string> = {};
  if (opts.settings && backup.settings) {
    for (const k of SETTINGS_KEYS) if (k in backup.settings) writes[k] = backup.settings[k];
  }
  if (opts.achievements && backup.achievements !== undefined) writes[ACHIEVEMENTS_KEY] = backup.achievements;
  if (opts.shifts && backup.shifts !== undefined) {
    try {
      await shiftsReady();
      restoreShifts(migrate(JSON.parse(backup.shifts)));
    } catch (err) { logDiag("warn", "backup", "cannot restore shifts", err); }
  }
  for (const [k, v] of Object.entries(writes)) {
    try { localStorage.setItem(k, v); } catch (err) { logDiag("warn", "backup", `cannot restore ${k}`, err); }
  }
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

export async function exportToMarkdown(notes: Note[]) {
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
    if (note.content) lines.push("", note.content);
    if (note.checklist?.length) {
      lines.push("");
      note.checklist.forEach((item) => {
        lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
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
<h1>🍺 NOTKI</h1>
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
