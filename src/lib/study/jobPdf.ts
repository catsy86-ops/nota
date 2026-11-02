import { money } from "./billing";
import { itemClientPrice, itemClientTotal, quoteTotals, QUOTE_KIND_LABEL, QUOTE_KINDS, type Job } from "./jobs";
import { PdfWriter, pdfFileName } from "./pdfWriter";

/**
 * H3.4: wycena zlecenia własnego jako PDF dla klienta. Ceny materiału już z marżą — marży osobno
 * klient nie widzi. Bez numeru faktury i podatków (decyzja H-3: faktury idą przez program księgowy).
 */

export const jobPdfName = (site: string) => pdfFileName("Wycena", site);

const dmy = (key: string) => key.split("-").reverse().join(".");
const qty = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });

export async function buildJobPdf(
  job: Job,
  card: { name: string; address: string; investor: string; phone?: string },
  opts: { company: string; today: string },
): Promise<Blob> {
  const w = await PdfWriter.create();
  if (opts.company.trim()) w.line(opts.company.trim(), 9, "bold");
  w.line("Wycena", 16, "bold");
  w.line(card.name, 11, "bold");
  w.line(`Data: ${dmy(opts.today)}`);
  if (card.investor) w.line(`Dla: ${card.investor}${card.phone ? `, tel. ${card.phone}` : ""}`);
  if (card.address) w.line(`Adres: ${card.address}`);
  if (job.scope) {
    w.heading("Zakres prac");
    w.line(job.scope, 10, "normal", 2);
  }
  for (const kind of QUOTE_KINDS) {
    const list = job.items.filter((i) => i.kind === kind);
    if (list.length === 0) continue;
    w.heading(QUOTE_KIND_LABEL[kind]);
    for (const i of list) {
      w.line(`${i.name}: ${qty(i.qty)} ${i.unit} × ${money(itemClientPrice(i, job.margin))} = ${money(itemClientTotal(i, job.margin))}`, 10, "normal", 2);
    }
  }
  if (job.items.length === 0) w.line("Brak pozycji wyceny.", 10, "normal", 2);
  w.gap(4);
  w.line(`Razem: ${money(quoteTotals(job).total)}`, 13, "bold");
  return w.finish();
}
