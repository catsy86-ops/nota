import { describe, expect, it } from "vitest";
import type { Job } from "./jobs";
import { jobsToInvoice } from "./toInvoice";

const item = { id: "q1", kind: "labor" as const, name: "Robota", qty: 1, unit: "usł.", price: 100, order: 0 };
const job = (status: Job["status"], statusAt: number, items = [item]): Job => ({ status, statusAt, created: 1, items });
const inv = (siteId: string, correction = false) => ({ siteId, invoice: correction ? { correction: {} } : {} });

describe("jobsToInvoice", () => {
  it("zrobione bez faktury, najdłużej czekające pierwsze", () => {
    const jobs = new Map([["b", job("done", 20)], ["a", job("done", 10)], ["c", job("booked", 5)], ["d", job("paid", 5)]]);
    expect(jobsToInvoice(jobs, []).map((r) => r.siteId)).toEqual(["a", "b"]);
  });

  it("pomija zlecenia z fakturą; sama korekta nie zdejmuje z listy", () => {
    const jobs = new Map([["a", job("done", 1)], ["b", job("done", 2)]]);
    expect(jobsToInvoice(jobs, [inv("a")]).map((r) => r.siteId)).toEqual(["b"]);
    expect(jobsToInvoice(jobs, [inv("a", true)]).map((r) => r.siteId)).toEqual(["a", "b"]);
  });

  it("zlecenie bez pozycji wyceny nie trafia na listę", () => {
    expect(jobsToInvoice(new Map([["a", job("done", 1, [])]]), [])).toEqual([]);
  });
});
