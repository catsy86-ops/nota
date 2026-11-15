import type { Job } from "./jobs";

/**
 * R3.3 planu Praca: zlecenia „zrobione”, do których nie wystawiono jeszcze żadnej faktury (korekty się nie liczą —
 * korekta zakłada, że faktura już jest). Najdłużej czekające pierwsze. Zlecenie bez pozycji wyceny nie ma czego
 * przenieść na fakturę, więc go pomijamy.
 */
export function jobsToInvoice(
  jobs: ReadonlyMap<string, Job>,
  invoices: readonly { siteId: string; invoice: { correction?: unknown } }[],
): { siteId: string; job: Job }[] {
  const invoiced = new Set(invoices.filter((r) => !r.invoice.correction).map((r) => r.siteId));
  return [...jobs.entries()]
    .filter(([siteId, job]) => job.status === "done" && job.items.length > 0 && !invoiced.has(siteId))
    .map(([siteId, job]) => ({ siteId, job }))
    .sort((a, b) => a.job.statusAt - b.job.statusAt || a.siteId.localeCompare(b.siteId));
}
