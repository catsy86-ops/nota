import { format } from "date-fns";
import { pl } from "date-fns/locale";
import jsPDF from "jspdf";
import type { Note } from "@/hooks/useNotes";

export function exportToJSON(notes: Note[], filename?: string): { filename: string; size: number } {
  const data = JSON.stringify(notes, null, 2);
  const name = filename || `kaczy-backup-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, name, "application/json");
  return { filename: name, size: new Blob([data]).size };
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
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error("Nieprawidłowy format");
        const notes: Note[] = data.map((n: Partial<Note> & Record<string, unknown>) => ({
          id: n.id || crypto.randomUUID(),
          title: n.title || "",
          content: n.content || "",
          color: n.color || "default",
          pinned: n.pinned ?? false,
          archived: n.archived ?? false,
          trashed: n.trashed ?? false,
          trashedAt: n.trashedAt ?? null,
          labels: n.labels ?? [],
          reminder: n.reminder ?? null,
          images: n.images ?? [],
          checklist: n.checklist ?? [],
          folderId: n.folderId ?? null,
          order: n.order ?? 0,
          createdAt: n.createdAt || Date.now(),
          updatedAt: n.updatedAt || Date.now(),
        }));
        resolve(notes);
      } catch (err) {
        reject(err);
      }
    };
    input.click();
  });
}
