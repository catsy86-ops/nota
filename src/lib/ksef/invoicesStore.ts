import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { buildFa3Xml } from "./fa3";
import { validateInvoice, type Invoice, type InvoiceLine, type InvoiceProblem } from "./invoice";
import { nextInvoiceNumber } from "./numbering";
import { getDeviceId, seriesStore } from "./sellerPrefs";
import { createYInvoices, sha256Hex, type InvoiceRecord } from "./yInvoices";

/** Wystawione faktury żyją w dokumencie Yjs notatek (`yInvoices.ts`); widoki dopisują je tylko przez `issueInvoice`. */
const yInvoices = createYInvoices(yjsStore.doc);

export const useInvoices = (): InvoiceRecord[] => useSyncExternalStore(yInvoices.subscribe, yInvoices.all);
export const getInvoices = (): InvoiceRecord[] => yInvoices.all();
export const getDamagedInvoices = () => yInvoices.damaged();
export const invoicesDump = () => yInvoices.dump();
export const mergeInvoicesDump = (raw: unknown) => yInvoices.mergeDump(raw);

const newId = () => `inv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export type IssueResult = { ok: true; record: InvoiceRecord } | { ok: false; problems: InvoiceProblem[] };

/**
 * Wystawia fakturę: nadaje numer z serii tego urządzenia, waliduje, składa XML FA(3), liczy SHA-256 i zapisuje
 * niezmienny rekord. Numer jest ostatni w kolejce (wyliczany tuż przed zapisem), więc szkic nie rezerwuje numeru.
 */
export function issueInvoice(siteId: string, draft: Omit<Invoice, "number">, now: number = Date.now()): Promise<IssueResult> {
  return inCriticalSection(() => issueLocked(siteId, draft, now));
}

/** Wystawianie jedno po drugim: `navigator.locks` między kartami, a w module kolejka obietnic (też gdy `locks` nie ma). */
let queue: Promise<unknown> = Promise.resolve();
function inCriticalSection<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(() => (typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request("notatnik-faktura", fn) : fn()));
  queue = run.catch(() => undefined);
  return run;
}

async function issueLocked(siteId: string, draft: Omit<Invoice, "number">, now: number): Promise<IssueResult> {
  const kind = draft.correction ? "FK" : "FV";
  const series = seriesStore.get();
  // Rok numeru to rok daty wystawienia na fakturze (nie zegara urządzenia).
  const y = Number(draft.issueDate.slice(0, 4));
  const year = Number.isInteger(y) && y >= 2000 ? y : new Date(now).getFullYear();
  const build = (number: string) => {
    const invoice: Invoice = { ...draft, number };
    return { invoice, xml: buildFa3Xml(invoice, now) };
  };
  const number = nextInvoiceNumber(series, year, yInvoices.numbers(), kind);
  const first = build(number);
  const problems = validateInvoice(first.invoice);
  if (problems.length > 0) return { ok: false, problems };
  let { invoice, xml } = first;
  let hash = await sha256Hex(xml);
  // Po `await` numer mógł zająć inny wpis (np. z synchronizacji) — liczymy ponownie.
  if (yInvoices.numbers().includes(invoice.number)) {
    ({ invoice, xml } = build(nextInvoiceNumber(series, year, yInvoices.numbers(), kind)));
    hash = await sha256Hex(xml);
  }
  const record: InvoiceRecord = { id: newId(), number: invoice.number, issuedAt: now, siteId, invoice, xml, hash, device: series, deviceId: getDeviceId() };
  if (!yInvoices.add(record)) return { ok: false, problems: [{ field: "store", message: "Nie udało się zapisać faktury (limit, zajęty numer albo uszkodzone dane)." }] };
  return { ok: true, record };
}

export interface CorrectionInput {
  /** Stan pozycji po korekcie (może być pusty = anulowanie całości). */
  lines: InvoiceLine[];
  reason: string;
  type: 1 | 2;
  /** Numer KSeF faktury korygowanej, jeśli ją wgrano. */
  ksefNumber?: string;
  issueDate: string;
}

/**
 * Wystawia fakturę korygującą do zapisanej faktury: stan „przed” to pozycje korygowanej (dla korekty korekty — jej
 * stan po), strony i tryb cen zostają, numer ma przedrostek FK z osobnym licznikiem. Oryginał pozostaje bez zmian.
 */
export function issueCorrection(original: InvoiceRecord, input: CorrectionInput, now: number = Date.now()): Promise<IssueResult> {
  const o = original.invoice;
  const { number: _n, ...base } = o;
  void _n;
  return issueInvoice(original.siteId, {
    ...base,
    issueDate: input.issueDate,
    lines: input.lines,
    correction: {
      originalNumber: original.number,
      originalIssueDate: o.issueDate,
      ...(input.ksefNumber?.trim() ? { ksefNumber: input.ksefNumber.trim() } : {}),
      reason: input.reason.trim(),
      type: input.type,
      linesBefore: o.lines,
    },
  }, now);
}

/** Czy w serii tego telefonu są faktury z innego urządzenia (ryzyko duplikatów numerów po synchronizacji). */
export function seriesUsedElsewhere(records: readonly InvoiceRecord[], series: string, deviceId: string): boolean {
  return records.some((r) => r.device === series && r.deviceId !== undefined && r.deviceId !== deviceId);
}
