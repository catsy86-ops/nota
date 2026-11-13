import type { InvoiceRecord } from "@/lib/ksef/yInvoices";
import { quoteSummary, unpaidTotal, type Job, type JobStatus } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";

/**
 * Historia klienta na jego karcie (plan wycen i klientów, 2.3): budowy i zlecenia z kartoteki powiązania, faktury
 * budów, otwarte zgłoszenia serwisowe i gwarancja. Czyste funkcje nad danymi, które widok już ma (katalog budów,
 * zlecenia, faktury) — nic nowego nie jest zapisywane.
 */

export interface ClientSiteRow {
  siteId: string;
  name: string;
  archived: boolean;
  /** Zlecenie własne tej budowy (fucha); brak = budowa szefa. */
  job?: { status: JobStatus; total: number };
  invoices: { id: string; number: string; issuedAt: number }[];
  /** Ostatni dzień gwarancji „RRRR-MM-DD”. */
  warranty?: string;
  /** Otwarte zgłoszenia serwisowe. */
  openService: number;
  /** Ostatnia aktywność (wpis, założenie karty) — do sortowania. */
  last: number;
}

export interface ClientHistory {
  rows: ClientSiteRow[];
  /** Suma wycen zleceń zrobionych, a jeszcze niezapłaconych (jak „Niezapłacone” na liście zleceń). */
  unpaid: number;
  invoiceCount: number;
  openService: number;
}

/** Budowy podane w `siteIds`, których nie ma już w katalogu (usunięte), są pomijane. */
export function clientHistory(
  siteIds: readonly string[],
  sites: readonly SiteInfo[],
  jobs: ReadonlyMap<string, Job>,
  invoices: readonly InvoiceRecord[],
): ClientHistory {
  const byId = new Map(sites.map((s) => [s.id, s]));
  const rows: ClientSiteRow[] = [];
  const doneJobs: Job[] = [];
  let invoiceCount = 0;
  let openService = 0;
  for (const id of new Set(siteIds)) {
    const site = byId.get(id);
    if (!site) continue;
    const job = jobs.get(id);
    const total = job ? quoteSummary(job).payable : 0;
    if (job?.status === "done") doneJobs.push(job);
    const mine = invoices.filter((r) => r.siteId === id).map((r) => ({ id: r.id, number: r.number, issuedAt: r.issuedAt })).sort((a, b) => b.issuedAt - a.issuedAt);
    invoiceCount += mine.length;
    const open = (site.service ?? []).filter((c) => c.done === undefined).length;
    openService += open;
    rows.push({
      siteId: id,
      name: site.name,
      archived: site.archived !== undefined,
      ...(job ? { job: { status: job.status, total } } : {}),
      invoices: mine,
      ...(site.warranty ? { warranty: site.warranty } : {}),
      openService: open,
      last: Math.max(site.last ?? -Infinity, site.created),
    });
  }
  rows.sort((a, b) => Number(a.archived) - Number(b.archived) || b.last - a.last || a.name.localeCompare(b.name, "pl"));
  return { rows, unpaid: unpaidTotal(doneJobs), invoiceCount, openService };
}
