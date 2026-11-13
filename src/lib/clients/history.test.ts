import { describe, expect, it } from "vitest";
import { clientHistory } from "./history";
import type { Job } from "@/lib/study/jobs";
import type { SiteInfo } from "@/lib/study/sites";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";

const site = (id: string, over: Partial<SiteInfo> = {}): SiteInfo =>
  ({ id, name: id, address: "", investor: "", created: 1, stored: true, count: 0, open: 0, first: null, last: null, ...over }) as SiteInfo;
const job = (status: Job["status"], price: number): Job =>
  ({ status, statusAt: 1, created: 1, items: [{ id: "i", kind: "labor", name: "x", qty: 1, unit: "usł.", price, order: 0 }] });
const inv = (id: string, siteId: string, issuedAt: number) => ({ id, number: `FV/${id}`, issuedAt, siteId }) as InvoiceRecord;

describe("clientHistory", () => {
  it("sumuje niezapłacone tylko ze zleceń zrobionych, liczy faktury i otwarte zgłoszenia", () => {
    const sites = [
      site("a", { service: [{ id: "s1", text: "cieknie", at: 1 }, { id: "s2", text: "ok", at: 2, done: 3 }], warranty: "2028-10-16" }),
      site("b"),
      site("c"),
    ];
    const jobs = new Map<string, Job>([["a", job("done", 500)], ["b", job("paid", 300)], ["c", job("quote", 100)]]);
    const h = clientHistory(["a", "b", "c"], sites, jobs, [inv("1", "a", 10), inv("2", "a", 20), inv("3", "b", 5)]);
    expect(h.unpaid).toBe(500);
    expect(h.invoiceCount).toBe(3);
    expect(h.openService).toBe(1);
    const a = h.rows.find((r) => r.siteId === "a")!;
    expect(a).toMatchObject({ warranty: "2028-10-16", openService: 1, job: { status: "done", total: 500 } });
    expect(a.invoices.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("pomija budowy, których nie ma w katalogu, i powtórzone id; archiwalne na końcu", () => {
    const h = clientHistory(["x", "a", "a", "z"], [site("a", { last: 100 }), site("z", { archived: 5, last: 999 })], new Map(), []);
    expect(h.rows.map((r) => r.siteId)).toEqual(["a", "z"]);
    expect(h.rows[1].archived).toBe(true);
    expect(h.rows[0].job).toBeUndefined();
  });

  it("nowsza aktywność wyżej, a brak budów daje pustą historię", () => {
    const h = clientHistory(["a", "b"], [site("a", { created: 1 }), site("b", { created: 1, last: 50 })], new Map(), []);
    expect(h.rows.map((r) => r.siteId)).toEqual(["b", "a"]);
    expect(clientHistory([], [], new Map(), [])).toEqual({ rows: [], unpaid: 0, invoiceCount: 0, openService: 0 });
  });
});
