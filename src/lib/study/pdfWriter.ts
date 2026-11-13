import { imageStore } from "@/lib/imageStore";
import { safeLine } from "@/lib/safeText";

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

export interface PdfColumn {
  header: string;
  /** Szerokość względna kolumny (skalowana do szerokości treści). */
  width: number;
  align?: "left" | "right";
}

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
  const clean = safeLine(subject.replace(/[\\/:*?"<>|]+/g, " ")).slice(0, 60) || "budowa";
  return `${prefix} - ${clean}.pdf`;
}

/** Bajty z magazynu jako data URL (do `addImage`). */
export const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * P2.4/H3.5: obraz podpisu klienta z magazynu jako data URL — tylko PNG/JPEG (klucz z innego urządzenia
 * może wskazywać dowolne bajty). `undefined` = brak podpisu albo obraz jeszcze nie dotarł na to urządzenie.
 */
export async function signatureDataUrl(sig: { image: string } | null | undefined): Promise<string | undefined> {
  const rec = sig ? await imageStore.get(sig.image) : undefined;
  const type = rec ? signatureImageType(new Uint8Array(rec.bytes)) : null;
  return rec && type ? blobToDataUrl(new Blob([rec.bytes], { type })) : undefined;
}

/** Podpis z pola to mały PNG; większe pliki i obrazy ponad 4000 px (bomba dekompresji) odpadają. */
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;
const SIGNATURE_MAX_PX = 4000;

/**
 * Rodzaj obrazu podpisu z bajtów, nie z zapisanego typu (ten przychodzi z innego urządzenia) — przegląd
 * bezpieczeństwa H3.5 L3. PNG: wymiary z nagłówka IHDR; JPEG trafia do PDF bez dekodowania.
 */
export function signatureImageType(b: Uint8Array): "image/png" | "image/jpeg" | null {
  if (b.byteLength > SIGNATURE_MAX_BYTES || b.byteLength < 24) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const w = dv.getUint32(16), h = dv.getUint32(20);
  return w > 0 && h > 0 && w <= SIGNATURE_MAX_PX && h <= SIGNATURE_MAX_PX ? "image/png" : null;
}

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

  /**
   * Tabela (wycena, plan wycen i klientów 3.4): kolumny o szerokościach względnych (rozciągane na całą szerokość treści),
   * nagłówek pogrubiony z linią, długie komórki łamane na kilka wierszy, cienka linia pod każdym wierszem. Po przejściu
   * na nową stronę nagłówek jest powtarzany; wiersz nigdy nie jest dzielony między strony.
   */
  table(cols: PdfColumn[], rows: string[][], size = 9) {
    const { doc } = this;
    const sum = cols.reduce((a, c) => a + c.width, 0) || 1;
    const widths = cols.map((c) => (c.width / sum) * CONTENT_W);
    const lh = size * 0.45;
    const draw = (cells: string[], bold: boolean) => {
      doc.setFont(FONT_ID, bold ? "bold" : "normal");
      doc.setFontSize(size);
      const wrapped = cells.map((t, i) => doc.splitTextToSize(t, widths[i] - 2) as string[]);
      const height = Math.max(1, ...wrapped.map((l) => l.length)) * lh;
      if (this.y + height + 2 > BOTTOM) {
        doc.addPage();
        this.y = MARGIN;
        if (!bold) { draw(cols.map((c) => c.header), true); doc.setFont(FONT_ID, "normal"); doc.setFontSize(size); }
      }
      let x = MARGIN;
      wrapped.forEach((lines, i) => {
        const right = cols[i].align === "right";
        lines.forEach((l, k) => doc.text(l, right ? x + widths[i] - 1 : x + 1, this.y + k * lh, right ? { align: "right" } : undefined));
        x += widths[i];
      });
      this.y += height + 1;
      doc.setDrawColor(bold ? 60 : 200);
      doc.setLineWidth(bold ? 0.3 : 0.1);
      doc.line(MARGIN, this.y, MARGIN + CONTENT_W, this.y);
      this.y += 1.5;
    };
    draw(cols.map((c) => c.header), true);
    for (const r of rows) draw(r, false);
  }

  /** Wiersz „etykieta ... kwota”: etykieta przy lewym marginesie, wartość wyrównana do prawego (podsumowanie wyceny). */
  keyValue(label: string, value: string, size = 10, style: "normal" | "bold" = "normal") {
    const { doc } = this;
    this.ensure(size * 0.45 + 1);
    doc.setFont(FONT_ID, style);
    doc.setFontSize(size);
    doc.text(label, MARGIN, this.y);
    doc.text(value, PAGE_W - MARGIN, this.y, { align: "right" });
    this.y += size * 0.45 + 0.8;
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

  /**
   * Pola na podpisy na końcu dokumentu. `signed` (P2.4) wstawia obraz podpisu nad drugą linią
   * z imieniem i datą pod spodem; bez niego obie linie zostają puste do podpisu długopisem.
   */
  signatures(labels: [string, string], signed?: { dataUrl?: string; caption: string }) {
    const { doc } = this;
    const blank = "____________________________";
    const first = `${labels[0]}: ${blank}          ${labels[1]}: `;
    this.ensure(signed ? 56 : 40);
    this.gap(8);
    if (signed?.dataUrl) {
      const boxW = 60, boxH = 24;
      // Obraz zaczyna się tam, gdzie linia drugiego podpisu (ta sama czcionka co `line` niżej).
      doc.setFont(FONT_ID, "normal");
      doc.setFontSize(10);
      const x = Math.min(MARGIN + doc.getTextWidth(first), MARGIN + CONTENT_W - boxW);
      try {
        const props = doc.getImageProperties(signed.dataUrl);
        const ratio = props.height / props.width;
        let w = boxW, h = boxW * ratio;
        if (h > boxH) { h = boxH; w = h / ratio; }
        doc.addImage(signed.dataUrl, x, this.y + boxH - h, w, h);
      } catch {
        // Uszkodzony obraz: zostaje pusta linia, imię i data niżej i tak są.
      }
      this.y += boxH + 1;
    }
    this.line(`${first}${blank}`, 10);
    this.gap(2);
    this.line(signed ? `Podpisał: ${signed.caption}` : "Data: ____________________", 10);
  }

  /** Numery stron, opcjonalna stopka po lewej (np. odcisk dokumentu) i zwrot pliku. */
  finish(footer?: string): Blob {
    const { doc } = this;
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont(FONT_ID, "normal");
      doc.setFontSize(8);
      doc.text(`Strona ${p} z ${total}`, PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
      if (footer) doc.text(footer, MARGIN, PAGE_H - 8);
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
