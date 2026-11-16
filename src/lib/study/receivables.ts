import { computeInvoice } from "@/lib/ksef/invoice";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";
import { round2, type BillingStatement } from "./billing";
import { quoteSummary, type Job } from "./jobs";
import { daysWaiting } from "./paymentReminder";

/**
 * R3.1 „Należności”: jedna lista tego, co kto wisi — z danych, które już są (rozliczenie budowy,
 * zlecenie ze statusem, wystawione faktury). Czysta funkcja; nic nie zapisuje.
 *
 * Budowa ma dwa niezależne źródła pieniędzy: rozliczenie z szefem/inwestorem (`billing.ts`: godziny,
 * punkty, ryczałt minus wpłaty) i własne zlecenie dla klienta (`jobs.ts`: wycena minus zaliczka).
 * Faktura nie ma własnego pola „zapłacona” — rozlicza ją status zlecenia tej samej budowy.
 * Żeby nie policzyć tej samej kwoty dwa razy, strona zlecenia daje najwyżej jeden wiersz na budowę:
 *   zlecenie „zapłacone” → nic;
 *   zlecenie „zrobione” → wiersz zlecenia (z numerem i terminem faktury, jeśli jest);
 *   faktura wystawiona przed „zrobione” albo bez zlecenia → wiersz faktury.
 */

export type ReceivableKind = "site" | "job" | "invoice";

export interface Receivable {
  /** Stały klucz wiersza (`kind:siteId`). */
  id: string;
  kind: ReceivableKind;
  siteId: string;
  /** Całość, wpłacono, zostało (zł). */
  total: number;
  paid: number;
  due: number;
  /** R3.4: ile procent już wpłynęło (0–100) — pasek „zapłacono 40%”. */
  paidPct: number;
  /** Od kiedy czeka (ms): ostatnia wpłata, chwila „zrobione” albo wystawienie faktury. */
  since: number;
  days: number;
  /** Numer faktury i termin płatności „RRRR-MM-DD”, jeśli faktura jest. */
  invoiceNumber?: string;
  dueDate?: string;
  /** Dni po terminie płatności z faktury; 0 = termin nie minął albo go nie ma. */
  overdueDays: number;
}

export interface ReceivablesInput {
  now: number;
  /** Zestawienia budów (`billingStatement`) — liczy je wywołujący, bo potrzebują godzin z Grafiku. */
  statements?: ReadonlyMap<string, BillingStatement>;
  /** Chwila założenia karty budowy — od niej liczy się czekanie budowy bez żadnej wpłaty. */
  siteCreated?: (siteId: string) => number | undefined;
  jobs: ReadonlyMap<string, Job>;
  invoices: readonly InvoiceRecord[];
}

export interface Receivables {
  /** Od najdłużej czekających; przy remisie większa kwota wyżej. */
  rows: Receivable[];
  /** Suma „zostało” ze wszystkich wierszy. */
  due: number;
  /** Ile wierszy czeka co najmniej `REMIND_AFTER_DAYS` — do miary „należności bez przypomnienia”. */
  stale: number;
}

export const REMIND_AFTER_DAYS = 14;

const pct = (paid: number, total: number) => (total > 0 ? Math.max(0, Math.min(100, Math.round((paid / total) * 100))) : 0);
/** Południe dnia: bezpieczne przy zmianie czasu i niezależne od godziny wystawienia. */
const noon = (day: string) => new Date(`${day}T12:00:00`).getTime();

function row(kind: ReceivableKind, siteId: string, total: number, paid: number, since: number, now: number, inv?: { number: string; dueDate?: string }): Receivable {
  const dueAt = inv?.dueDate ? noon(inv.dueDate) : NaN;
  return {
    id: `${kind}:${siteId}`, kind, siteId,
    total: round2(total), paid: round2(paid), due: round2(total - paid), paidPct: pct(paid, total),
    since, days: daysWaiting(since, now),
    ...(inv ? { invoiceNumber: inv.number } : {}),
    ...(inv?.dueDate ? { dueDate: inv.dueDate } : {}),
    overdueDays: Number.isFinite(dueAt) ? daysWaiting(dueAt, now) : 0,
  };
}

/**
 * Faktury budowy jako jedna kwota brutto (zł): faktury zwykłe plus różnice z korekt (suma może spaść do zera).
 * Numer i termin bierzemy z ostatniej faktury zwykłej — korekta nie zmienia terminu zapłaty pierwotnej.
 */
function invoiceState(list: readonly InvoiceRecord[]): { gross: number; number: string; dueDate?: string; issuedAt: number } | null {
  if (list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.issuedAt - b.issuedAt || a.id.localeCompare(b.id));
  const main = [...sorted].reverse().find((r) => !r.invoice.correction) ?? sorted[sorted.length - 1];
  const grosze = sorted.reduce((s, r) => s + computeInvoice(r.invoice).gross, 0);
  return { gross: grosze / 100, number: main.number, dueDate: main.invoice.payment?.dueDate, issuedAt: main.issuedAt };
}

export function receivables(input: ReceivablesInput): Receivables {
  const { now, jobs, invoices } = input;
  const rows: Receivable[] = [];

  for (const [siteId, st] of input.statements ?? []) {
    if (st.due <= 0) continue;
    const lastPay = st.payments.reduce((m, p) => (p.day > m ? p.day : m), "");
    const since = lastPay ? noon(lastPay) : input.siteCreated?.(siteId) ?? now;
    rows.push(row("site", siteId, st.accrued, st.paid, since, now));
  }

  const bySite = new Map<string, InvoiceRecord[]>();
  for (const r of invoices) {
    const list = bySite.get(r.siteId);
    if (list) list.push(r);
    else bySite.set(r.siteId, [r]);
  }

  for (const siteId of new Set([...jobs.keys(), ...bySite.keys()])) {
    const job = jobs.get(siteId);
    if (job?.status === "paid") continue;
    const inv = invoiceState(bySite.get(siteId) ?? []);
    if (job?.status === "done") {
      const q = quoteSummary(job);
      if (q.due > 0) rows.push(row("job", siteId, q.payable, q.paid, job.statusAt, now, inv ?? undefined));
      continue;
    }
    // Faktura przed końcem roboty (albo bez zlecenia): czeka kwota z faktury; zaliczka ze zlecenia ją pomniejsza.
    if (!inv || inv.gross <= 0) continue;
    const paid = job ? Math.min(quoteSummary(job).paid, inv.gross) : 0;
    if (inv.gross - paid > 0) rows.push(row("invoice", siteId, inv.gross, paid, inv.issuedAt, now, inv));
  }

  rows.sort((a, b) => Math.max(b.days, b.overdueDays) - Math.max(a.days, a.overdueDays) || b.due - a.due || a.id.localeCompare(b.id));
  return {
    rows,
    due: round2(rows.reduce((s, r) => s + r.due, 0)),
    stale: rows.filter((r) => r.days >= REMIND_AFTER_DAYS).length,
  };
}
