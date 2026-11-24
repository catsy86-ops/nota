import { describe, expect, it } from "vitest";
import { jobTimeline, type TimelineInput } from "./jobTimeline";
import type { QuoteItem } from "./jobs";

const item: QuoteItem = { id: "q1", kind: "labor", name: "Bateria", qty: 1, unit: "usł.", price: 120, order: 0 };
const states = (i: TimelineInput) => jobTimeline(i).map((s) => `${s.step}:${s.state}`);
const base: TimelineInput = { job: { status: "quote", items: [] }, signed: false, invoiced: false };

describe("jobTimeline", () => {
  it("puste zlecenie: bieżąca jest wycena, reszta do zrobienia", () => {
    expect(states(base)).toEqual([
      "quote:current", "deposit:todo", "work:todo", "protocol:todo", "invoice:todo", "payment:todo", "warranty:todo",
    ]);
  });

  it("wycena z pozycjami: bieżąca zaliczka", () => {
    expect(states({ ...base, job: { status: "quote", items: [item] } }).slice(0, 2)).toEqual(["quote:done", "deposit:current"]);
  });

  it("umówione bez zaliczki: zaliczka pominięta, bieżąca realizacja", () => {
    expect(states({ ...base, job: { status: "booked", items: [item] } }).slice(1, 3)).toEqual(["deposit:skipped", "work:current"]);
  });

  it("zrobione z zaliczką i podpisem: bieżąca faktura", () => {
    const r = states({ job: { status: "done", items: [item], doc: { depositPaid: 100 } }, signed: true, invoiced: false });
    expect(r.slice(0, 5)).toEqual(["quote:done", "deposit:done", "work:done", "protocol:done", "invoice:current"]);
  });

  it("zapłacone z fakturą bez gwarancji: bieżąca gwarancja", () => {
    const r = jobTimeline({ job: { status: "paid", items: [item] }, signed: true, invoiced: true });
    expect(r.find((s) => s.state === "current")?.step).toBe("warranty");
  });

  it("wszystko zrobione: brak bieżącego kroku", () => {
    const r = jobTimeline({ job: { status: "paid", items: [item], doc: { depositPaid: 50 } }, signed: true, invoiced: true, warranty: "2028-11-24" });
    expect(r.every((s) => s.state === "done")).toBe(true);
  });
});
