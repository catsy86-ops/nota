import { format } from "date-fns";
import { pl } from "date-fns/locale";
import jsPDF from "jspdf";
import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { noteSchema, fullBackupSchema, looksLikeNoteArray, type FullBackup } from "@/lib/noteSchema";

export function exportToJSON(notes: Note[], filename?: string): { filename: string; size: number } {
  const data = JSON.stringify(notes, null, 2);
  const name = filename || `kaczy-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
}

/** Pełny backup: notatki + etykiety + foldery, wystarczający do odtworzenia całej bazy. */
export async function exportFullBackup(filename?: string): Promise<{ filename: string; size: number }> {
  await yjsStore.ready();
  const backup: FullBackup = {
    version: 1,
    exportedAt: Date.now(),
    notes: yjsStore.projectNotes(),
    labels: yjsStore.projectLabels(),
    folders: yjsStore.projectFolders(),
  };
  const data = JSON.stringify(backup, null, 2);
  const name = filename || `kaczy-full-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
}

const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Wczytuje i waliduje plik pełnego backupu, zapisuje bezpośrednio do IndexedDB. */
export function importFullBackup(): Promise<FullBackup> {
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
        const raw = JSON.parse(text);
        if (!raw || typeof raw !== "object" || !Array.isArray((raw as Record<string, unknown>).notes)) {
          throw new Error("To nie jest plik pełnego backupu KACZY");
        }
        const backup = fullBackupSchema.parse(raw);
        await yjsStore.ready();
        yjsStore.replaceAll(backup.notes, backup.folders, backup.labels);
        resolve(backup);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik backupu"));
      }
    };
    input.click();
  });
}

function addImagesToPDF(doc: jsPDF, images: string[], margin: number, contentW: number, y: number): number {
  const maxImgHeight = 70;
  for (const img of images) {
    try {
      const props = doc.getImageProperties(img);
      const ratio = props.height / props.width;
      let w = contentW;
      let h = w * ratio;
      if (h > maxImgHeight) { h = maxImgHeight; w = h / ratio; }
      if (y + h > 275) { doc.addPage(); y = 20; }
      doc.addImage(img, margin, y, w, h);
      y += h + 4;
    } catch {
      // Nieznany/uszkodzony format obrazu — pomiń ten jeden obrazek, nie przerywaj eksportu.
    }
  }
  return y;
}

export function exportToPDF(notes: Note[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("KACZY", margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Eksport: ${format(new Date(), "d MMMM yyyy, HH:mm", { locale: pl })}`, margin, y);
  doc.setTextColor(0);
  y += 12;

  for (const note of notes) {
    // Check if we need a new page
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Title
    if (note.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const titleLines = doc.splitTextToSize(note.title, contentW);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 5 + 2;
    }

    // Labels
    if (note.labels.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Etykiety: ${note.labels.join(", ")}`, margin, y);
      doc.setTextColor(0);
      y += 5;
    }

    // Reminder
    if (note.reminder) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Przypomnienie: ${format(new Date(note.reminder), "d MMM yyyy, HH:mm", { locale: pl })}`, margin, y);
      doc.setTextColor(0);
      y += 5;
    }

    // Content
    if (note.content) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(note.content, contentW);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 2;
    }

    // Images
    if (note.images?.length) {
      y = addImagesToPDF(doc, note.images, margin, contentW, y);
    }

    // Separator
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  }

  doc.save("kaczy-export.pdf");
}

function download(content: string, filename: string, type: string) {
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
  lines.push(`# KACZY — Eksport`);
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
<title>KACZY — Eksport</title>
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
<h1>🦆 KACZY</h1>
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
