import { round2 } from "./billing";
import { quoteSummary, type Job } from "./jobs";
import { quoteState, type QuoteState } from "./quoteDoc";

/**
 * Przegląd wycen (plan wycen i klientów, 5.4): ile wycen w wybranym miesiącu wysłano, przyjęto i odrzucono (z sumami kwot
 * do zapłaty) oraz skuteczność = przyjęte / (przyjęte + odrzucone). Miesiąc wg czasu lokalnego znacznika (`sentAt`,
 * `acceptedAt`, `rejectedAt`); wycena przyjęta w tym miesiącu liczy się do przyjętych także, gdy wysłano ją wcześniej.
 */

export interface MonthBucket {
  count: number;
  /** Suma kwot do zapłaty wycen z tego koszyka (zł). */
  total: number;
}

export interface QuoteReview {
  month: string;
  sent: MonthBucket;
  accepted: MonthBucket;
  rejected: MonthBucket;
  /** Procent przyjętych wśród rozstrzygniętych (0–100, bez miejsc po przecinku); `null`, gdy nic nie rozstrzygnięto. */
  rate: number | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** Miesiąc „RRRR-MM” z chwili w czasie lokalnym. */
export const monthKeyOf = (at: number): string => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };

export function quoteReview(jobs: Iterable<Pick<Job, "items" | "margin" | "doc">>, month: string): QuoteReview {
  const buckets = { sent: { count: 0, total: 0 }, accepted: { count: 0, total: 0 }, rejected: { count: 0, total: 0 } };
  for (const job of jobs) {
    const d = job.doc;
    if (!d) continue;
    const payable = quoteSummary(job).payable;
    for (const [field, bucket] of [["sentAt", buckets.sent], ["acceptedAt", buckets.accepted], ["rejectedAt", buckets.rejected]] as const) {
      const at = d[field];
      if (at !== undefined && monthKeyOf(at) === month) { bucket.count += 1; bucket.total = round2(bucket.total + payable); }
    }
  }
  const decided = buckets.accepted.count + buckets.rejected.count;
  return { month, ...buckets, rate: decided > 0 ? Math.round((buckets.accepted.count / decided) * 100) : null };
}

/** Filtr stanu na liście zleceń: „all” albo jeden ze stanów wyceny. */
export type QuoteFilter = "all" | QuoteState;
export const QUOTE_FILTERS: readonly QuoteFilter[] = ["all", "draft", "sent", "accepted", "rejected"];

export function matchesQuoteFilter(job: Pick<Job, "doc">, filter: QuoteFilter): boolean {
  return filter === "all" || quoteState(job.doc) === filter;
}
