import { money } from "./billing";
import { itemClientPrice, itemClientTotal, quoteTotals, QUOTE_KIND_LABEL, QUOTE_KINDS, signatureValidFor, type Job } from "./jobs";
import { PdfWriter, pdfFileName } from "./pdfWriter";
import type { SiteSignature } from "./signature";

/**
 * H3.4: wycena zlecenia własnego jako PDF dla klienta. Ceny materiału już z marżą — marży osobno
 * klient nie widzi. Bez numeru faktury i podatków (decyzja H-3: faktury idą przez program księgowy).
 */

export const jobPdfName = (site: string) => pdfFileName("Wycena", site);
export const jobDonePdfName = (site: string) => pdfFileName("Potwierdzenie wykonania", site);

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

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * H3.5: potwierdzenie wykonania fuchy dla klienta — zakres, pozycje, kwota i podpis klienta z karty
 * (`SiteCard.signature`, ten sam co na protokole, P2.4). Bez faktury (H-3). Podpis tylko jako obraz
 * w PDF — tekst nie powtarza nic poza imieniem i datą.
 */
export async function buildJobDonePdf(
  job: Job,
  card: { name: string; address: string; investor: string; phone?: string; signature?: SiteSignature },
  opts: { company: string; today: string; signatureDataUrl?: string },
): Promise<Blob> {
  const w = await PdfWriter.create();
  if (opts.company.trim()) w.line(opts.company.trim(), 9, "bold");
  w.line("Potwierdzenie wykonania", 16, "bold");
  w.line(card.name, 11, "bold");
  w.line(`Data: ${dmy(opts.today)}`);
  if (card.investor) w.line(`Klient: ${card.investor}`);
  if (card.address) w.line(`Adres: ${card.address}`);
  w.heading("Wykonane prace");
  if (job.scope) w.line(job.scope, 10, "normal", 2);
  for (const i of job.items) {
    w.line(`${QUOTE_KIND_LABEL[i.kind]}: ${i.name}, ${qty(i.qty)} ${i.unit} = ${money(itemClientTotal(i, job.margin))}`, 10, "normal", 2);
  }
  if (!job.scope && job.items.length === 0) w.line("Zakres jak w zleceniu.", 10, "normal", 2);
  w.gap(4);
  const total = quoteTotals(job).total;
  if (total > 0) w.line(job.status === "paid" ? `Zapłacono: ${money(total)}` : `Do zapłaty: ${money(total)}`, 13, "bold");
  w.line("Klient potwierdza wykonanie prac bez zastrzeżeń.", 10);
  // Podpis sprzed ostatniej zmiany wyceny nie trafia pod nową treść — zostaje pusta linia (M1).
  const sig = signatureValidFor(job, card.signature) ? card.signature : undefined;
  w.signatures(["Wykonawca", "Klient"], sig
    ? { dataUrl: opts.signatureDataUrl, caption: `${sig.name || "klient"}, ${shortDate(sig.at)}${opts.signatureDataUrl ? "" : " (obraz podpisu niedostępny)"}` }
    : undefined);
  return w.finish();
}
