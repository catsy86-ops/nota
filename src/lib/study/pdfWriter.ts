/**
 * Wspólny zapis PDF dla protokołu i raportu (P2.5): jsPDF ładowany leniwie, polskie znaki z czcionki
 * Barlow Condensed (`public/fonts/protokol-*.ttf`, OFL — wbudowane fonty jsPDF ich nie mają),
 * łamanie wierszy, numery stron, siatka zdjęć 2×3 i pola na podpisy.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 18;
const FONT_ID = "Protokol";
/** Zdjęcia na stronie: 2 w rzędzie, 3 rzędy. */
export const PDF_PHOTOS_PER_PAGE = 6;

export interface PdfPhoto {
  dataUrl: string;
  caption: string;
}

/** Ile zdjęć przypada na kolejne strony: po `PDF_PHOTOS_PER_PAGE`, reszta na ostatniej. */
export function photoPages(count: number): number[] {
  const pages: number[] = [];
  for (let left = count; left > 0; left -= PDF_PHOTOS_PER_PAGE) pages.push(Math.min(PDF_PHOTOS_PER_PAGE, left));
  return pages;
}

/** Nazwa pliku PDF: bez znaków, które źle znoszą systemy plików, z ograniczeniem długości. */
export function pdfFileName(prefix: string, subject: string): string {
  const clean = subject.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "budowa";
  return `${prefix} - ${clean}.pdf`;
}

/** Bajty z magazynu jako data URL (do `addImage`). */
export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

type JsPdf = InstanceType<typeof import("jspdf").default>;

export class PdfWriter {
  readonly doc: JsPdf;
  y = MARGIN;

  private constructor(doc: JsPdf) {
    this.doc = doc;
  }

  /** Nowy dokument A4 z obiema wagami czcionki. */
  static async create(): Promise<PdfWriter> {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const base = typeof location !== "undefined" ? location.origin : "http://localhost";
    doc.addFont(new URL("/fonts/protokol-regular.ttf", base), FONT_ID, "normal", 400, "Identity-H");
    doc.addFont(new URL("/fonts/protokol-bold.ttf", base), FONT_ID, "bold", 700, "Identity-H");
    return new PdfWriter(doc);
  }

  ensure(h: number) {
    if (this.y + h > BOTTOM) { this.doc.addPage(); this.y = MARGIN; }
  }

  line(text: string, size = 10, style: "normal" | "bold" = "normal", indent = 0) {
    const { doc } = this;
    doc.setFont(FONT_ID, style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent) as string[];
    for (const l of lines) {
      this.ensure(size * 0.45);
      doc.text(l, MARGIN + indent, this.y);
      this.y += size * 0.45;
    }
  }

  gap(mm = 3) { this.y += mm; }

  heading(text: string) {
    this.gap(3);
    this.ensure(10);
    this.line(text, 11, "bold");
    this.gap(1);
  }

  /** Zdjęcia 2×3 z podpisami; kolejna strona co `PDF_PHOTOS_PER_PAGE`. */
  photos(list: PdfPhoto[]) {
    const { doc } = this;
    const colW = (CONTENT_W - 6) / 2;
    const cellH = 62;
    let slot = 0;
    for (const p of list) {
      const col = slot % 2;
      if (col === 0) {
        if (slot > 0 && slot % PDF_PHOTOS_PER_PAGE === 0) { doc.addPage(); this.y = MARGIN; }
        else this.ensure(cellH + 6);
      }
      const x = MARGIN + col * (colW + 6);
      try {
        const props = doc.getImageProperties(p.dataUrl);
        const ratio = props.height / props.width;
        let w = colW, h = colW * ratio;
        if (h > cellH - 8) { h = cellH - 8; w = h / ratio; }
        doc.addImage(p.dataUrl, x, this.y, w, h);
      } catch {
        doc.setFont(FONT_ID, "normal");
        doc.setFontSize(8);
        doc.text("(zdjęcia nie udało się wczytać)", x, this.y + 5);
      }
      doc.setFont(FONT_ID, "normal");
      doc.setFontSize(8);
      doc.text(doc.splitTextToSize(p.caption, colW)[0] as string, x, this.y + cellH - 3);
      slot += 1;
      if (col === 1) this.y += cellH + 4;
    }
    if (slot % 2 === 1) this.y += cellH + 4;
  }

  /** Pola na podpisy na końcu dokumentu. */
  signatures(labels: [string, string]) {
    this.ensure(40);
    this.gap(8);
    this.line(`${labels[0]}: ____________________________          ${labels[1]}: ____________________________`, 10);
    this.gap(2);
    this.line("Data: ____________________", 10);
  }

  /** Numery stron i zwrot pliku. */
  finish(): Blob {
    const { doc } = this;
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont(FONT_ID, "normal");
      doc.setFontSize(8);
      doc.text(`Strona ${p} z ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
    }
    return doc.output("blob");
  }
}

/** Udostępnia plik przez systemowy arkusz (Web Share), a bez niego pobiera. */
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
