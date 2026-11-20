import { handoverPointLine, signerLabel, type Handover } from "./handover";
import { PdfWriter, pdfFileName, photoPages, sharePdf, signatureDataUrl, type PdfPhoto } from "./pdfWriter";
import { PDF_TYPE } from "@/lib/pdfType";

/**
 * P2.5: protokół odbioru jako plik PDF. Układ i czcionka są we wspólnym `pdfWriter.ts`; tu tylko treść.
 * Zdjęcia dostaje od wywołującego jako data URL (bajty są w `imageStore`).
 */

export { photoPages, sharePdf, signatureDataUrl };
export type HandoverPdfPhoto = PdfPhoto;

export interface HandoverPdfOptions {
  /** Nazwa firmy z Ustawień Pracy (pusta = bez nagłówka). */
  company: string;
  photos: HandoverPdfPhoto[];
  /** P2.4: obraz podpisu klienta jako data URL (bajty z `imageStore`); brak = puste pola. */
  signatureDataUrl?: string;
  /** B4.4: tekst stopki z odciskiem dokumentu (na każdej stronie); brak = bez stopki. */
  footer?: string;
}

/** Nazwa pliku dla protokołu. */
export const handoverPdfName = (site: string) => pdfFileName("Protokol odbioru", site);

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const dmy = (key: string) => key.split("-").reverse().join(".");

export async function buildHandoverPdf(h: Handover, opts: HandoverPdfOptions): Promise<Blob> {
  const w = await PdfWriter.create();

  if (opts.company.trim()) w.line(opts.company.trim(), PDF_TYPE.table, "bold");
  w.line("Protokół odbioru instalacji wodno-kanalizacyjnej", PDF_TYPE.title, "bold");
  w.line(h.site, PDF_TYPE.heading, "bold");
  if (h.address) w.line(`Adres: ${h.address}`);
  if (h.investor) w.line(`Inwestor: ${h.investor}`);
  if (h.period) w.line(`Okres prac: ${h.period}`);
  w.line(`Data protokołu: ${h.date}`);

  if (h.stages && h.stages.length > 0) {
    w.heading("Zakres prac (etapy)");
    for (const s of h.stages) w.line(`[${s.done !== undefined ? "x" : " "}] ${s.name}${s.done !== undefined ? ` — ${shortDate(s.done)}` : ""}`, PDF_TYPE.body, "normal", 2);
  }

  if (h.rooms && h.pointsDone) {
    w.heading(`Punkty (${h.pointsDone.done}/${h.pointsDone.total} gotowe)`);
    for (const r of h.rooms) {
      w.line(r.name, PDF_TYPE.body, "bold", 2);
      for (const p of r.points) w.line(handoverPointLine(p, shortDate), PDF_TYPE.body, "normal", 4);
    }
  }

  w.heading("Próby szczelności");
  if (h.tests.length === 0) w.line("Brak protokołów prób w dzienniku.", PDF_TYPE.body, "normal", 2);
  for (const t of h.tests) {
    w.line(`${shortDate(t.at)} ${t.line}`, PDF_TYPE.body, "normal", 2);
    if (t.readings) w.line(`Odczyty: ${t.readings}`, PDF_TYPE.table, "normal", 6);
  }

  if (h.slopes.length > 0) {
    w.heading("Spadki rur (pomiar orientacyjny z telefonu)");
    for (const sl of h.slopes) w.line(`${shortDate(sl.at)} ${sl.line}`, PDF_TYPE.body, "normal", 2);
    w.line("Czujnik telefonu myli się o ok. 0,1–0,2°; pomiar nie zastępuje poziomicy.", PDF_TYPE.small, "normal", 2);
  }

  w.heading("Uwagi (otwarte problemy)");
  if (h.remarks.length === 0) w.line("Brak uwag — wszystkie zgłoszone problemy rozwiązane.", PDF_TYPE.body, "normal", 2);
  for (const r of h.remarks) {
    const meta = [r.owner ? `odpowiedzialny: ${r.owner}` : null, r.due ? `termin: ${dmy(r.due)}` : null, r.photosAfter ? `po naprawie: ${r.photosAfter} zdj.` : null].filter(Boolean);
    w.line(`${shortDate(r.at)} ${r.text}${meta.length ? ` (${meta.join(", ")})` : ""}`, PDF_TYPE.body, "normal", 2);
  }

  if (opts.photos.length > 0) {
    w.heading("Zdjęcia");
    w.photos(opts.photos);
  }

  const signed = h.signature
    ? { dataUrl: opts.signatureDataUrl, caption: `${signerLabel(h.signature)}, ${shortDate(h.signature.at)}${opts.signatureDataUrl ? "" : " (obraz podpisu niedostępny)"}` }
    : undefined;
  w.signatures(["Wykonawca", "Inwestor"], signed);
  return w.finish(opts.footer);
}
