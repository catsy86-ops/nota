import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { noteSchema, fullBackupSchema, looksLikeNoteArray, type FullBackup } from "@/lib/noteSchema";
import { tryWriteBackupToFile } from "@/lib/backupFileHandle";
import { versionsStore } from "@/lib/versionsStore";
import { logDiag } from "@/lib/diagnostics";

export function exportToJSON(notes: Note[], filename?: string): { filename: string; size: number } {
  const data = JSON.stringify(notes, null, 2);
  const name = filename || `kaczy-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
}

/** Zawartość pełnego backupu v2 (bez zapisu do pliku). */
export async function buildFullBackup(): Promise<FullBackup> {
  await yjsStore.ready();
  await versionsStore.load();
  return {
    version: 2,
    exportedAt: Date.now(),
    notes: yjsStore.projectNotes(),
    labels: yjsStore.projectLabels(),
    folders: yjsStore.projectFolders(),
    versions: versionsStore.all(),
    settings: readKeys(SETTINGS_KEYS),
    achievements: readKeys([ACHIEVEMENTS_KEY])[ACHIEVEMENTS_KEY],
  };
}

/**
 * Pełny backup: notatki + etykiety + foldery, wystarczający do odtworzenia całej bazy.
 * Jeśli w Ustawieniach wybrano jeden, zapamiętany plik (File System Access API,
 * desktop Chrome/Edge), nadpisuje go zamiast pobierać kolejny plik do Pobranych.
 */
export async function exportFullBackup(
  filename?: string,
  { allowDownload = true }: { allowDownload?: boolean } = {},
): Promise<{ filename: string; size: number; savedToFile: boolean; downloaded: boolean }> {
  const backup = await buildFullBackup();
  const data = JSON.stringify(backup, null, 2);
  const name = filename || `kaczy-full-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  const savedToFile = await tryWriteBackupToFile(data);
  // Pobranie bez gestu użytkownika przeglądarki blokują albo o nie pytają —
  // auto-backup przekazuje `allowDownload: false` i prosi o kliknięcie.
  const downloaded = !savedToFile && allowDownload;
  if (downloaded) download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size, savedToFile, downloaded };
}

const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
        resolve(parseFullBackup(await file.text()));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik backupu"));
      }
    };
    input.click();
  });
}

export function parseFullBackup(text: string): FullBackup {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).notes)) {
    throw new Error("To nie jest plik pełnego backupu aplikacji NOTKI");
  }
  return fullBackupSchema.parse(raw);
}

export interface RestoreOptions { versions: boolean; settings: boolean; achievements: boolean }

/**
 * Przywraca backup: notatki, foldery i etykiety zawsze (destrukcyjnie),
 * pozostałe sekcje tylko zaznaczone i obecne w pliku. Ustawienia działają
 * po przeładowaniu strony, które i tak następuje po przywróceniu.
 */
export async function restoreFullBackup(backup: FullBackup, opts: RestoreOptions): Promise<void> {
  await yjsStore.ready();
  yjsStore.replaceAll(backup.notes, backup.folders, backup.labels);
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

export function exportToMarkdown(notes: Note[]) {
  const lines: string[] = [];
  lines.push(`# NOTKI — eksport`);
  lines.push(`> ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl })}`);
  lines.push("");

  for (const note of notes) {
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
    if (note.images?.length) {
      lines.push("");
      note.images.forEach((img, i) => lines.push(`![obraz ${i + 1}](${img})`));
    }
    lines.push("", "---", "");
  }

  download(lines.join("\n"), "kaczy-export.md", "text/markdown");
}

export function exportToHTML(notes: Note[]) {
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dateStr = format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl });

  let html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
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

  for (const note of notes) {
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
    if (note.images?.length) {
      html += `<div class="images">`;
      note.images.forEach((img) => { html += `<img src="${img}" alt="">`; });
      html += `</div>`;
    }
    html += `</div>\n`;
  }

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
        if (!looksLikeNoteArray(data)) throw new Error("Nieprawidłowy format — oczekiwano listy notatek");
        const notes = data.map((n) => noteSchema.parse(n));
        resolve(notes);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik"));
      }
    };
    input.click();
  });
}
