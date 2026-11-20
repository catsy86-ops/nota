import { money, type BillingStatement } from "./billing";
import { PdfWriter, pdfFileName } from "./pdfWriter";
import { PDF_TYPE } from "@/lib/pdfType";

/** H3.2: zestawienie należności budowy jako PDF. Układ i czcionka we wspólnym `pdfWriter.ts`. */

export const billingPdfName = (site: string) => pdfFileName("Rozliczenie", site);

const dmy = (key: string) => key.split("-").reverse().join(".");

export async function buildBillingPdf(site: string, st: BillingStatement, opts: { company: string; today: string }): Promise<Blob> {
  const w = await PdfWriter.create();
  if (opts.company.trim()) w.line(opts.company.trim(), PDF_TYPE.table, "bold");
  w.line("Rozliczenie budowy", PDF_TYPE.title, "bold");
  w.line(site, PDF_TYPE.heading, "bold");
  w.line(`Stan na ${dmy(opts.today)}`);

  w.heading("Naliczone");
  if (st.lines.length === 0) w.line("Nic jeszcze nie naliczone.", PDF_TYPE.body, "normal", 2);
  for (const l of st.lines) w.line(`${l.label}: ${l.detail} = ${money(l.amount)}`, PDF_TYPE.body, "normal", 2);
  w.line(`Razem: ${money(st.accrued)}`, PDF_TYPE.body, "bold", 2);

  w.heading("Otrzymane");
  if (st.payments.length === 0) w.line("Brak wpłat.", PDF_TYPE.body, "normal", 2);
  for (const p of st.payments) w.line(`${dmy(p.day)}: ${money(p.amount)}${p.note ? ` (${p.note})` : ""}`, PDF_TYPE.body, "normal", 2);
  if (st.payments.length > 0) w.line(`Razem: ${money(st.paid)}`, PDF_TYPE.body, "bold", 2);

  w.gap(4);
  w.line(st.due >= 0 ? `Zostało do zapłaty: ${money(st.due)}` : `Nadpłata: ${money(-st.due)}`, PDF_TYPE.subtitle, "bold");
  if (st.warnings.length > 0) {
    w.heading("Uwagi");
    for (const t of st.warnings) w.line(t, PDF_TYPE.table, "normal", 2);
  }
  return w.finish();
}
