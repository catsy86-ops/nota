import { format } from "date-fns";
import { pl } from "date-fns/locale";
import jsPDF from "jspdf";
import type { Note } from "@/hooks/useNotes";
import { embeddableImages } from "@/lib/exportNotes";

// Split out from exportNotes.ts: jsPDF (+ the html2canvas it dynamically
// pulls in) is the single heaviest dependency in the app but only used by
// this one rarely-clicked export button — kept out of the eager main bundle
// so daily app opens don't pay for it. Loaded on demand via dynamic import()
// in AppHeader.tsx.

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

export async function exportToPDF(notes: Note[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("NOTATKI PIJACKIE", margin, y);
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
    const images = await embeddableImages(note.images ?? []);
    if (images.length) {
      y = addImagesToPDF(doc, images, margin, contentW, y);
    }

    // Separator
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
  }

  doc.save("kaczy-export.pdf");
}
