import { PdfWriter, pdfFileName } from "@/lib/study/pdfWriter";
import { money } from "@/lib/study/billing";
import { computeInvoice, computeLines, type Invoice } from "./invoice";
import { invoiceQrUrl, qrPngDataUrl } from "./qr";
import type { InvoiceRecord } from "./yInvoices";

/**
 * Wizualizacja faktury w PDF (KSeF Etap 1, ADR-6) — czytelna kopia dla klienta; prawnie obowiązuje plik XML. Zawiera
 * KOD I (adres z NIP, datą i skrótem XML) z podpisem „OFFLINE”, bo faktura nie została jeszcze wgrana do KSeF
 * (numeru KSeF aplikacja nie zna). Ładowana leniwie.
 */

export const invoicePdfName = (number: string) => pdfFileName("Faktura", number);

const zl = (grosze: number) => money(grosze / 100);
const dmy = (key: string) => key.split("-").reverse().join(".");
const PAY_LABEL: Record<number, string> = { 1: "gotówka", 2: "karta", 6: "przelew", 7: "płatność mobilna" };

export async function buildInvoicePdf(r: InvoiceRecord): Promise<Blob> {
  const inv = r.invoice;
  const t = computeInvoice(inv);
  const w = await PdfWriter.create();

  const c = inv.correction;
  w.line(c ? "Faktura korygująca" : "Faktura VAT", 16, "bold");
  w.line(`Nr ${r.number}`, 12, "bold");
  if (c) {
    w.line(`Dotyczy faktury ${c.originalNumber} z dnia ${dmy(c.originalIssueDate)}${c.ksefNumber ? ` (KSeF: ${c.ksefNumber})` : ""}`);
    w.line(`Przyczyna korekty: ${c.reason}`);
  }
  w.line(`Data wystawienia: ${dmy(inv.issueDate)}   ·   Data wykonania usługi: ${dmy(inv.saleDate)}`);

  w.heading("Sprzedawca");
  w.line(inv.seller.name, 10, "bold");
  w.line([inv.seller.address1, inv.seller.address2].filter(Boolean).join(", "));
  w.line(`NIP: ${inv.seller.nip}`);

  w.heading("Nabywca");
  w.line(inv.buyer.name, 10, "bold");
  if (inv.buyer.address1) w.line([inv.buyer.address1, inv.buyer.address2].filter(Boolean).join(", "));
  if (inv.buyer.nip) w.line(`NIP: ${inv.buyer.nip}`);

  const unit = inv.priceMode === "gross" ? "brutto" : "netto";
  const lineText = (l: Invoice["lines"][number], i: number, a: { net: number; gross: number }) => {
    const qty = l.qtyMilli / 1000;
    return `${i + 1}. ${l.name} — ${qty} ${l.unit} × ${zl(l.unitPrice)} = ${zl(inv.priceMode === "gross" ? a.gross : a.net)} (VAT ${l.rate === 0 ? "0%" : `${l.rate}%`})`;
  };
  if (c) {
    w.heading(`Przed korektą (ceny ${unit})`);
    const before = computeLines({ lines: c.linesBefore, priceMode: inv.priceMode });
    c.linesBefore.forEach((l, i) => w.line(lineText(l, i, before.lines[i]), 10, "normal", 2));
  }
  w.heading(c ? `Po korekcie (ceny ${unit})` : `Pozycje (ceny ${unit})`);
  if (inv.lines.length === 0) w.line("Brak pozycji (faktura anulowana w całości)", 10, "normal", 2);
  inv.lines.forEach((l, i) => w.line(lineText(l, i, t.lines[i]), 10, "normal", 2));

  w.heading(c ? "Różnica (po korekcie − przed)" : "Podsumowanie");
  for (const g of t.byRate) w.line(`Stawka ${g.rate}%: netto ${zl(g.net)}, VAT ${zl(g.vat)}, brutto ${zl(g.gross)}`, 10, "normal", 2);
  w.line(c ? `Razem różnica: ${zl(t.gross)}` : `Razem do zapłaty: ${zl(t.gross)}`, 13, "bold");

  if (inv.payment) {
    w.heading("Płatność");
    const p = inv.payment;
    w.line(`Forma: ${PAY_LABEL[p.form] ?? "inna"}${p.dueDate ? `   ·   Termin: ${dmy(p.dueDate)}` : ""}`);
    if (p.form === 6 && p.account) w.line(`Rachunek: ${p.account}`);
  }

  w.gap(4);
  const url = invoiceQrUrl(r);
  const png = await qrPngDataUrl(url);
  w.ensure(png ? 52 : 14);
  if (png) {
    w.doc.addImage(png, "PNG", 15, w.y, 34, 34);
    w.y += 36;
    w.line("OFFLINE", 8, "bold");
  }
  w.line("Kod QR i skrót prowadzą do tej faktury w KSeF po wgraniu pliku XML. Obowiązującą wersją faktury jest plik XML (FA(3)).", 8);
  w.line(`SHA-256 pliku XML: ${r.hash}`, 7);
  return w.finish();
}
