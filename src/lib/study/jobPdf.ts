import { dmyKey, money, round2 } from "./billing";
import { itemClientPrice, itemClientTotal, QUOTE_KIND_LABEL, QUOTE_KINDS, quoteSummary, signatureValidFor, type Job } from "./jobs";
import { effectiveValidUntil } from "./quoteDoc";
import { PdfWriter, pdfFileName, type PdfColumn } from "./pdfWriter";
import type { SiteSignature } from "./signature";

/**
 * H3.4 / plan wycen i klientów 3.4: wycena zlecenia własnego jako PDF dla klienta — numer, daty, dane klienta, tabela
 * pozycji, rabat, VAT, uwagi i warunki, miejsce na podpis (z obrazem podpisu klienta, gdy jest ważny dla obecnej treści,
 * 3.6). Ceny materiału już z marżą — marży osobno klient nie widzi. Bez numeru faktury (faktura to osobny dokument, `ksef/`).
 */

export const jobPdfName = (site: string) => pdfFileName("Wycena", site);
export const jobDonePdfName = (site: string) => pdfFileName("Potwierdzenie wykonania", site);

const qty = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

export interface PdfClient {
  name?: string;
  nip?: string;
  address?: string;
  phone?: string;
}

type SummaryRow = { label: string; value: string };

/** Podsumowanie wyceny: wiersze pośrednie (suma pozycji i rabat, rozbicie VAT — gdy są) oraz wiersz „do zapłaty” osobno. */
export function summaryParts(job: Pick<Job, "items" | "margin" | "doc">): { detail: SummaryRow[]; total: SummaryRow } {
  const s = quoteSummary(job);
  const detail: SummaryRow[] = [];
  const vatMode = job.doc?.vatMode;
  if (s.discount > 0) {
    detail.push({ label: vatMode === "gross" ? "Suma pozycji (brutto)" : vatMode === "net" ? "Suma pozycji (netto)" : "Suma pozycji", value: money(s.subtotal) });
    detail.push({ label: `Rabat ${qty(job.doc?.discount ?? 0)}%`, value: `−${money(s.discount)}` });
  }
  if (s.net !== undefined && s.vat !== undefined) {
    detail.push({ label: vatMode === "gross" ? "w tym netto" : "Razem netto", value: money(s.net) });
    detail.push({ label: `${vatMode === "gross" ? "w tym " : ""}VAT ${s.vatRate}%`, value: money(s.vat) });
  }
  return { detail, total: { label: s.net !== undefined ? "Razem brutto do zapłaty" : "Razem", value: money(s.payable) } };
}

/** Wiersze zaliczki na wycenie: żądana kwota i to, co zostaje do zapłaty po niej; nic, gdy zaliczki nie ma. */
export function depositRows(job: Pick<Job, "items" | "margin" | "doc">): { label: string; value: string }[] {
  const deposit = job.doc?.deposit;
  if (!deposit) return [];
  const payable = quoteSummary(job).payable;
  return [
    { label: "Zaliczka przed rozpoczęciem prac", value: money(Math.min(deposit, payable)) },
    { label: "Pozostało po zaliczce", value: money(Math.max(0, round2(payable - deposit))) },
  ];
}

const noteLines = (notes: string) => notes.split("\n").map((l) => l.trim()).filter(Boolean);

export async function buildJobPdf(
  job: Job,
  card: { name: string; address: string; investor: string; phone?: string; signature?: SiteSignature },
  opts: { company: string; today: string; client?: PdfClient; signatureDataUrl?: string },
): Promise<Blob> {
  const w = await PdfWriter.create();
  const doc = job.doc;
  if (opts.company.trim()) w.line(opts.company.trim(), 9, "bold");
  w.line("Wycena", 16, "bold");
  if (doc?.number) w.line(`Nr ${doc.number}`, 12, "bold");
  w.line(`Data wystawienia: ${dmyKey(doc?.issued ?? opts.today)}${effectiveValidUntil(doc) ? `   ·   Ważna do: ${dmyKey(effectiveValidUntil(doc)!)}` : ""}`);
  w.line(card.name, 11, "bold");

  const c = opts.client;
  const forName = c?.name || card.investor;
  if (forName) {
    w.heading("Dla");
    w.line(forName, 10, "bold");
    if (c?.address) w.line(c.address);
    if (c?.nip) w.line(`NIP: ${c.nip}`);
    const phone = c?.phone || card.phone;
    if (phone) w.line(`Tel. ${phone}`);
  }
  if (card.address) w.line(`Miejsce wykonania: ${card.address}`);

  if (job.scope) {
    w.heading("Zakres prac");
    w.line(job.scope, 10, "normal", 2);
  }

  w.heading("Pozycje");
  if (job.items.length === 0) {
    w.line("Brak pozycji wyceny.", 10, "normal", 2);
  } else {
    const tag = doc?.vatMode === "net" ? " netto" : doc?.vatMode === "gross" ? " brutto" : "";
    const cols: PdfColumn[] = [
      { header: "Lp.", width: 6 },
      { header: "Nazwa", width: 44 },
      { header: "Ilość", width: 11, align: "right" },
      { header: "J.m.", width: 9 },
      { header: `Cena${tag}`, width: 16, align: "right" },
      { header: `Wartość${tag}`, width: 18, align: "right" },
    ];
    // Robocizna przed materiałem, w obrębie rodzaju kolejność z wyceny; rodzaj w nawiasie przy nazwie, gdy są oba.
    const ordered = QUOTE_KINDS.flatMap((k) => job.items.filter((i) => i.kind === k));
    const both = new Set(job.items.map((i) => i.kind)).size > 1;
    w.table(cols, ordered.map((i, n) => [
      String(n + 1),
      both ? `${i.name} (${QUOTE_KIND_LABEL[i.kind].toLowerCase()})` : i.name,
      qty(i.qty),
      i.unit,
      money(itemClientPrice(i, job.margin)),
      money(itemClientTotal(i, job.margin)),
    ]));
  }

  w.gap(3);
  const { detail, total: grand } = summaryParts(job);
  for (const r of detail) w.keyValue(r.label, r.value);
  w.keyValue(grand.label, grand.value, 13, "bold");
  for (const r of depositRows(job)) w.keyValue(r.label, r.value);

  if (doc?.notes) {
    w.heading("Uwagi i warunki");
    for (const l of noteLines(doc.notes)) w.line(l, 10, "normal", 2);
  }

  // Podpis sprzed ostatniej zmiany wyceny nie trafia pod nową treść — zostaje puste pole do podpisu długopisem.
  const sig = signatureValidFor(job, card.signature) ? card.signature : undefined;
  w.heading("Akceptacja wyceny");
  w.signatures(["Wykonawca", "Klient"], sig
    ? { dataUrl: opts.signatureDataUrl, caption: `${sig.name || "klient"}, ${shortDate(sig.at)}${opts.signatureDataUrl ? "" : " (obraz podpisu niedostępny)"}` }
    : undefined);
  return w.finish();
}

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
  if (job.doc?.number) w.line(`Dotyczy wyceny ${job.doc.number}`, 10);
  w.line(card.name, 11, "bold");
  w.line(`Data: ${dmyKey(opts.today)}`);
  if (card.investor) w.line(`Klient: ${card.investor}`);
  if (card.address) w.line(`Adres: ${card.address}`);
  w.heading("Wykonane prace");
  if (job.scope) w.line(job.scope, 10, "normal", 2);
  for (const i of job.items) {
    w.line(`${QUOTE_KIND_LABEL[i.kind]}: ${i.name}, ${qty(i.qty)} ${i.unit} = ${money(itemClientTotal(i, job.margin))}`, 10, "normal", 2);
  }
  if (!job.scope && job.items.length === 0) w.line("Zakres jak w zleceniu.", 10, "normal", 2);
  w.gap(4);
  const s = quoteSummary(job);
  const total = s.payable;
  if (total > 0) {
    // Rabat i VAT z wyceny, żeby kwota na potwierdzeniu zgadzała się z wyceną (bez ostatniego wiersza — ten jest niżej).
    for (const r of summaryParts(job).detail) w.keyValue(r.label, r.value);
    if (job.status === "paid") w.line(`Zapłacono: ${money(total)}`, 13, "bold");
    else {
      // Wpłacona zaliczka pomniejsza „do zapłaty” (5.3): klient widzi, co już wpłacił i ile zostało.
      if (s.paid > 0) { w.keyValue("Razem", money(total)); w.keyValue("Wpłacono (zaliczka)", `−${money(s.paid)}`); }
      w.line(`Do zapłaty: ${money(s.due)}`, 13, "bold");
    }
  }
  w.line("Klient potwierdza wykonanie prac bez zastrzeżeń.", 10);
  const sig = signatureValidFor(job, card.signature) ? card.signature : undefined;
  w.signatures(["Wykonawca", "Klient"], sig
    ? { dataUrl: opts.signatureDataUrl, caption: `${sig.name || "klient"}, ${shortDate(sig.at)}${opts.signatureDataUrl ? "" : " (obraz podpisu niedostępny)"}` }
    : undefined);
  return w.finish();
}
