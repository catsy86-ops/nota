import { reportBody, type JournalReport } from "./report";
import { PdfWriter, pdfFileName, type PdfPhoto } from "./pdfWriter";

/**
 * P2.5: raport dnia/tygodnia jako PDF. Treść to ta sama co w tekście raportu (`reportBody`):
 * nagłówki `##` → nagłówki PDF, punkty → lista. Zdjęcia z podpisami z raportu.
 */

/** Najwięcej zdjęć w PDF raportu; reszta zostaje w paczce ZIP (jak w protokole). */
export const REPORT_PDF_PHOTOS_MAX = 24;

export const reportPdfName = (title: string) => pdfFileName("Raport", title.replace(/^Raport:\s*/, ""));

export async function buildReportPdf(r: JournalReport, opts: { company: string; photos: PdfPhoto[] }): Promise<Blob> {
  const w = await PdfWriter.create();
  if (opts.company.trim()) w.line(opts.company.trim(), 9, "bold");
  w.line(r.title, 16, "bold");
  w.line(r.period, 10);
  for (const l of reportBody(r).split("\n")) {
    if (l.startsWith("## ")) w.heading(l.slice(3));
    else if (l === "") w.gap(1);
    else if (l.startsWith("- ")) w.line(`• ${l.slice(2)}`, 10, "normal", 2);
    else w.line(l);
  }
  if (opts.photos.length > 0) {
    w.heading("Zdjęcia");
    w.photos(opts.photos.slice(0, REPORT_PDF_PHOTOS_MAX));
  }
  return w.finish();
}
