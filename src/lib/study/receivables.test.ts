import { describe, expect, it } from "vitest";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";
import type { BillingStatement } from "./billing";
import type { Job } from "./jobs";
import { receivables, REMIND_AFTER_DAYS } from "./receivables";

const DAY = 86_400_000;
const NOW = new Date("2026-11-23T12:00:00").getTime();

const statement = (accrued: number, payments: { day: string; amount: number }[] = []): BillingStatement => {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { lines: [], accrued, paid, due: accrued - paid, warnings: [], payments: payments.map((p, i) => ({ id: `p${i}`, ...p })) };
};
const job = (over: Partial<Job>): Job => ({
  status: "quote", statusAt: NOW, created: NOW,
  items: [{ id: "i", kind: "labor", name: "Robocizna", qty: 1, unit: "szt.", price: 1000, order: 0 }],
  ...over,
});
/** Faktura z jedną pozycją w cenach brutto — kwota w złotych. */
const invoice = (siteId: string, gross: number, issuedAt: number, dueDate?: string): InvoiceRecord => ({
  id: `inv-${siteId}`, siteId, number: `FV/1/${siteId}`, issuedAt,
  invoice: {
    number: `FV/1/${siteId}`, issueDate: "2026-11-19", saleDate: "2026-11-19",
    seller: { name: "Jan Kowalski", nip: "5260250274", address1: "ul. Lipowa 5" },
    buyer: { name: "Anna Nowak", nip: "", address1: "ul. Polna 2" },
    priceMode: "gross",
    lines: [{ name: "Usługa", unit: "szt.", qtyMilli: 1000, unitPrice: gross * 100, rate: 8 }],
    ...(dueDate ? { payment: { dueDate } } : {}),
  },
} as unknown as InvoiceRecord);

describe("receivables (R3.1, R3.4)", () => {
  it("budowa z saldem: czeka od ostatniej wpłaty, pasek zapłaconych procent", () => {
    const r = receivables({
      now: NOW, jobs: new Map(), invoices: [],
      statements: new Map([["s1", statement(5000, [{ day: "2026-11-03", amount: 2000 }])]]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id: "site:s1", kind: "site", total: 5000, paid: 2000, due: 3000, paidPct: 40, days: 20 });
    expect(r.due).toBe(3000);
    expect(r.stale).toBe(1);
  });

  it("budowa rozliczona albo z nadpłatą — bez wiersza; bez wpłat czeka od założenia karty", () => {
    const r = receivables({
      now: NOW, jobs: new Map(), invoices: [],
      statements: new Map([["s1", statement(1000, [{ day: "2026-11-01", amount: 1000 }])], ["s2", statement(800)]]),
      siteCreated: (id) => (id === "s2" ? NOW - 3 * DAY : undefined),
    });
    expect(r.rows.map((x) => x.id)).toEqual(["site:s2"]);
    expect(r.rows[0].days).toBe(3);
    expect(r.stale).toBe(0);
  });

  it("zlecenie „zrobione”: jeden wiersz z numerem faktury — faktura nie jest liczona drugi raz", () => {
    const r = receivables({
      now: NOW, statements: new Map(),
      jobs: new Map([["k1", job({ status: "done", statusAt: NOW - 5 * DAY })]]),
      invoices: [invoice("k1", 1000, NOW - 4 * DAY, "2026-11-20")],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ kind: "job", due: 1000, days: 5, invoiceNumber: "FV/1/k1", dueDate: "2026-11-20", overdueDays: 3 });
  });

  it("zlecenie zapłacone — nic; zaliczka pomniejsza kwotę i daje pasek", () => {
    const paid = receivables({ now: NOW, statements: new Map(), invoices: [], jobs: new Map([["k1", job({ status: "paid" })]]) });
    expect(paid.rows).toEqual([]);
    const deposit = receivables({
      now: NOW, statements: new Map(), invoices: [],
      jobs: new Map([["k1", job({ status: "done", doc: { depositPaid: 250 } as Job["doc"] })]]),
    });
    expect(deposit.rows[0]).toMatchObject({ total: 1000, paid: 250, due: 750, paidPct: 25 });
  });

  it("faktura przed „zrobione” albo bez zlecenia — wiersz faktury", () => {
    const r = receivables({ now: NOW, statements: new Map(), jobs: new Map(), invoices: [invoice("k2", 600, NOW - 2 * DAY)] });
    expect(r.rows[0]).toMatchObject({ kind: "invoice", siteId: "k2", due: 600, days: 2, overdueDays: 0 });
  });

  it("kolejność: najdłużej czekające (albo najdłużej po terminie) wyżej, przy remisie większa kwota", () => {
    const r = receivables({
      now: NOW, jobs: new Map(), invoices: [],
      statements: new Map([
        ["a", statement(100, [{ day: "2026-11-13", amount: 50 }])],
        ["b", statement(900, [{ day: "2026-11-13", amount: 100 }])],
        ["c", statement(500, [{ day: "2026-10-24", amount: 100 }])],
      ]),
    });
    expect(r.rows.map((x) => x.siteId)).toEqual(["c", "b", "a"]);
    expect(r.stale).toBe(1);
    expect(REMIND_AFTER_DAYS).toBe(14);
  });
});
