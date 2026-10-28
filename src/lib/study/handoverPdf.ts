import type { Handover } from "./handover";

/**
 * P2.5: protokół odbioru jako prawdziwy plik PDF (jsPDF, leniwie — jak eksport notatek). Czcionka
 * `public/fonts/protokol-*.ttf` (Barlow Condensed, OFL) ma polskie znaki; wbudowane fonty jsPDF ich nie mają.
 * Układ: nagłówek firmy, dane budowy, etapy, próby, uwagi (odpowiedzialny, termin), zdjęcia 2×3 z podpisami,
 * pola na podpisy i numery stron. Zdjęcia dostaje od wywołującego jako data URL (bajty są w `imageStore`).
 */

export interface HandoverPdfPhoto {
  dataUrl: string;
  caption: string;
}

export interface HandoverPdfOptions {
  /** Nazwa firmy z Ustawień Pracy (pusta = bez nagłówka). */
  company: string;
  photos: HandoverPdfPhoto[];
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 18;
/** Zdjęcia na kartce: 2 w rzędzie, 3 rzędy. */
export const PDF_PHOTOS_PER_PAGE = 6;
const FONT_ID = "Protokol";

/** Ile zdjęć przypada na kolejne strony: stała liczba slotów, reszta na ostatniej. */
export function photoPages(count: number): number[] {
  const pages: number[] = [];
  for (let left = count; left > 0; left -= PDF_PHOTOS_PER_PAGE) pages.push(Math.min(PDF_PHOTOS_PER_PAGE, left));
  return pages;
}

/** Nazwa pliku dla protokołu: bez znaków, które źle znoszą systemy plików. */
export function handoverPdfName(site: string): string {
  const clean = site.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "budowa";
  return `Protokol odbioru - ${clean}.pdf`;
}

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const dmy = (key: string) => key.split("-").reverse().join(".");

/** Ładuje obie wagi czcionki z `public/fonts`; bez nich PDF nie ma polskich znaków, więc to błąd, nie cisza. */
async function loadFonts(doc: { addFont: (...a: unknown[]) => unknown }): Promise<void> {
  const base = typeof location !== "undefined" ? location.origin : "http://localhost";
  doc.addFont(new URL("/fonts/protokol-regular.ttf", base), FONT_ID, "normal", 400, "Identity-H");
  doc.addFont(new URL("/fonts/protokol-bold.ttf", base), FONT_ID, "bold", 700, "Identity-H");
}

export async function buildHandoverPdf(h: Handover, opts: HandoverPdfOptions): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await loadFonts(doc as unknown as { addFont: (...a: unknown[]) => unknown });
  let y = MARGIN;

  const ensure = (h2: number) => { if (y + h2 > BOTTOM) { doc.addPage(); y = MARGIN; } };
  const line = (text: string, size = 10, style: "normal" | "bold" = "normal", indent = 0) => {
    doc.setFont(FONT_ID, style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    for (const l of lines) {
      ensure(size * 0.45);
      doc.text(l, MARGIN + indent, y);
      y += size * 0.45;
    }
  };
  const gap = (mm = 3) => { y += mm; };
  const heading = (text: string) => { gap(3); ensure(10); line(text, 11, "bold"); gap(1); };

  if (opts.company.trim()) line(opts.company.trim(), 9, "bold");
  line(`Protokół odbioru instalacji wodno-kanalizacyjnej`, 16, "bold");
  line(h.site, 11, "bold");
  if (h.address) line(`Adres: ${h.address}`);
  if (h.investor) line(`Inwestor: ${h.investor}`);
  if (h.period) line(`Okres prac: ${h.period}`);
  line(`Data protokołu: ${h.date}`);

  if (h.stages && h.stages.length > 0) {
    heading("Zakres prac (etapy)");
    for (const s of h.stages) line(`[${s.done !== undefined ? "x" : " "}] ${s.name}${s.done !== undefined ? ` — ${shortDate(s.done)}` : ""}`, 10, "normal", 2);
  }

  heading("Próby szczelności");
  if (h.tests.length === 0) line("Brak protokołów prób w dzienniku.", 10, "normal", 2);
  for (const t of h.tests) line(`${shortDate(t.at)} ${t.line}`, 10, "normal", 2);

  heading("Uwagi (otwarte problemy)");
  if (h.remarks.length === 0) line("Brak uwag — wszystkie zgłoszone problemy rozwiązane.", 10, "normal", 2);
  for (const r of h.remarks) {
    const meta = [r.owner ? `odpowiedzialny: ${r.owner}` : null, r.due ? `termin: ${dmy(r.due)}` : null, r.photosAfter ? `po naprawie: ${r.photosAfter} zdj.` : null].filter(Boolean);
    line(`${shortDate(r.at)} ${r.text}${meta.length ? ` (${meta.join(", ")})` : ""}`, 10, "normal", 2);
  }

  if (opts.photos.length > 0) {
    heading("Zdjęcia");
    const colW = (CONTENT_W - 6) / 2;
    const cellH = 62;
    let slot = 0;
    for (const p of opts.photos) {
      const col = slot % 2;
      if (col === 0) {
        if (slot > 0 && slot % PDF_PHOTOS_PER_PAGE === 0) { doc.addPage(); y = MARGIN; }
        else ensure(cellH + 6);
      }
      const x = MARGIN + col * (colW + 6);
      try {
        const props = doc.getImageProperties(p.dataUrl);
        const ratio = props.height / props.width;
        let w = colW, hgt = colW * ratio;
        if (hgt > cellH - 8) { hgt = cellH - 8; w = hgt / ratio; }
        doc.addImage(p.dataUrl, x, y, w, hgt);
      } catch {
        doc.setFont(FONT_ID, "normal");
        doc.setFontSize(8);
        doc.text("(zdjęcia nie udało się wczytać)", x, y + 5);
      }
      doc.setFont(FONT_ID, "normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(p.caption, colW)[0] as string, x, y + cellH - 3);
      slot += 1;
      if (col === 1) y += cellH + 4;
    }
    if (slot % 2 === 1) y += cellH + 4;
  }

  // Pola na podpisy zawsze na ostatniej stronie, z zapasem miejsca.
  ensure(40);
  gap(8);
  line("Wykonawca: ____________________________          Inwestor: ____________________________", 10);
  gap(2);
  line("Data: ____________________", 10);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(FONT_ID, "normal");
    doc.setFontSize(8);
    doc.text(`Strona ${p} z ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }
  return doc.output("blob");
}

/** Udostępnia plik przez systemowy arkusz (Web Share), a bez niego pobiera. Zwraca, co zrobiono. */
export async function sharePdf(blob: Blob, name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], name, { type: "application/pdf" });
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav?.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: name });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
