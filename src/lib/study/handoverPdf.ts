import { handoverPointLine, type Handover } from "./handover";
import { PdfWriter, pdfFileName, photoPages, sharePdf, type PdfPhoto } from "./pdfWriter";

/**
 * P2.5: protokół odbioru jako plik PDF. Układ i czcionka są we wspólnym `pdfWriter.ts`; tu tylko treść.
 * Zdjęcia dostaje od wywołującego jako data URL (bajty są w `imageStore`).
 */

export { photoPages, sharePdf };
export type HandoverPdfPhoto = PdfPhoto;

export interface HandoverPdfOptions {
  /** Nazwa firmy z Ustawień Pracy (pusta = bez nagłówka). */
  company: string;
  photos: HandoverPdfPhoto[];
}

/** Nazwa pliku dla protokołu. */
export const handoverPdfName = (site: string) => pdfFileName("Protokol odbioru", site);

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const dmy = (key: string) => key.split("-").reverse().join(".");

export async function buildHandoverPdf(h: Handover, opts: HandoverPdfOptions): Promise<Blob> {
  const w = await PdfWriter.create();

  if (opts.company.trim()) w.line(opts.company.trim(), 9, "bold");
  w.line("Protokół odbioru instalacji wodno-kanalizacyjnej", 16, "bold");
  w.line(h.site, 11, "bold");
  if (h.address) w.line(`Adres: ${h.address}`);
  if (h.investor) w.line(`Inwestor: ${h.investor}`);
  if (h.period) w.line(`Okres prac: ${h.period}`);
  w.line(`Data protokołu: ${h.date}`);

  if (h.stages && h.stages.length > 0) {
    w.heading("Zakres prac (etapy)");
    for (const s of h.stages) w.line(`[${s.done !== undefined ? "x" : " "}] ${s.name}${s.done !== undefined ? ` — ${shortDate(s.done)}` : ""}`, 10, "normal", 2);
  }

  if (h.rooms && h.pointsDone) {
    w.heading(`Punkty (${h.pointsDone.done}/${h.pointsDone.total} gotowe)`);
    for (const r of h.rooms) {
      w.line(r.name, 10, "bold", 2);
      for (const p of r.points) w.line(handoverPointLine(p, shortDate), 10, "normal", 4);
    }
  }

  w.heading("Próby szczelności");
  if (h.tests.length === 0) w.line("Brak protokołów prób w dzienniku.", 10, "normal", 2);
  for (const t of h.tests) w.line(`${shortDate(t.at)} ${t.line}`, 10, "normal", 2);

  w.heading("Uwagi (otwarte problemy)");
  if (h.remarks.length === 0) w.line("Brak uwag — wszystkie zgłoszone problemy rozwiązane.", 10, "normal", 2);
  for (const r of h.remarks) {
    const meta = [r.owner ? `odpowiedzialny: ${r.owner}` : null, r.due ? `termin: ${dmy(r.due)}` : null, r.photosAfter ? `po naprawie: ${r.photosAfter} zdj.` : null].filter(Boolean);
    w.line(`${shortDate(r.at)} ${r.text}${meta.length ? ` (${meta.join(", ")})` : ""}`, 10, "normal", 2);
  }

  if (opts.photos.length > 0) {
    w.heading("Zdjęcia");
    w.photos(opts.photos);
  }

  w.signatures(["Wykonawca", "Inwestor"]);
  return w.finish();
}
