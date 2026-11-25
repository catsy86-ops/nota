import { format } from "date-fns";
import { pl } from "date-fns/locale";
import type { Note } from "@/lib/types/note";
import { filledPropEntries, type PropDef } from "@/lib/noteProps";
import type { FullBackup } from "@/lib/noteSchema";
import { tryWriteBackupToFile } from "@/lib/backupFileHandle";
import { formatFileSize } from "@/lib/attachments";
import { download } from "@/lib/downloadBlob";
import { APP_NAME } from "@/lib/appName";
import { buildFullBackupWithReport, describeSkippedAttachments, embeddableImages, withEmbeddedImages, withStoredImages, type BackupAttachmentReport } from "./build";
import { MAX_IMPORT_FILE_SIZE, isBackupOversize, loadSchemas, parseFullBackup } from "./parse";

/** Zapis i odczyt plików (DOM: `<input type=file>`, pobieranie, `navigator.share`) — jedyne miejsce kopii, które dotyka przeglądarki. */
export { download };

export async function exportToJSON(notes: Note[], filename?: string): Promise<{ filename: string; size: number }> {
  const data = JSON.stringify(await withEmbeddedImages(notes), null, 2);
  const name = filename || `notki-kopia-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
}

/**
 * Pełny backup: notatki + etykiety + foldery, wystarczający do odtworzenia całej bazy.
 * Jeśli w Ustawieniach wybrano jeden, zapamiętany plik (File System Access API,
 * desktop Chrome/Edge), nadpisuje go zamiast pobierać kolejny plik do Pobranych.
 */
export async function exportFullBackup(
  filename?: string,
  { allowDownload = true, confirm }: { allowDownload?: boolean; confirm?: (report: BackupAttachmentReport) => Promise<boolean> } = {},
): Promise<{ filename: string; size: number; savedToFile: boolean; downloaded: boolean; attachments: BackupAttachmentReport; cancelled: boolean; oversize: boolean }> {
  const { backup, attachments } = await buildFullBackupWithReport();
  // D3: gdy kopia pominie załączniki, pytamy przed zapisem (kopia jest już zbudowana, nic nie buduje się drugi raz).
  if (confirm && describeSkippedAttachments(attachments) && !(await confirm(attachments))) {
    return { filename: "", size: 0, savedToFile: false, downloaded: false, attachments, cancelled: true, oversize: false };
  }
  const data = JSON.stringify(backup, null, 2);
  const name = filename || `notki-kopia-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  const savedToFile = await tryWriteBackupToFile(data);
  // Pobranie bez gestu użytkownika przeglądarki blokują albo o nie pytają —
  // auto-backup przekazuje `allowDownload: false` i prosi o kliknięcie.
  const downloaded = !savedToFile && allowDownload;
  if (downloaded) download(data, name, "application/json");
  const size = new Blob([data]).size;
  return { filename: name, size, savedToFile, downloaded, attachments, cancelled: false, oversize: isBackupOversize(size) };
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

/**
 * C3 planu mobile: pełny backup jako plik w arkuszu udostępniania (`navigator.share`), bez zapisu na dysku.
 * Te same pytania o pominięte załączniki co przy zapisie. `unsupported`, gdy przeglądarka nie udostępnia plików.
 */
export async function shareFullBackup(confirm?: (report: BackupAttachmentReport) => Promise<boolean>): Promise<"shared" | "cancelled" | "unsupported"> {
  const { backup, attachments } = await buildFullBackupWithReport();
  if (confirm && describeSkippedAttachments(attachments) && !(await confirm(attachments))) return "cancelled";
  const name = `notki-kopia-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  const file = new File([JSON.stringify(backup)], name, { type: "application/json" });
  if (typeof navigator.canShare !== "function" || !navigator.canShare({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ title: "Kopia NOTKI", files: [file] });
    return "shared";
  } catch (err) {
    // Anulowanie arkusza to nie błąd.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    throw err;
  }
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
  download(lines.join("\n"), "notki-eksport.md", "text/markdown");
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
<h1>${APP_NAME}</h1>
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
  download(html, "notki-eksport.html", "text/html");
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
