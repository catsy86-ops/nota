import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEPOSIT_PAYMENT_ID, receiveDeposit, revertDeposit } from "./quoteDeposit";
import { getSiteBilling } from "./billingStore";
import { getJobs, saveQuoteItem, setJobMeta, setQuoteDoc } from "./jobsStore";
import { quoteSummary, unpaidTotal, type Job } from "./jobs";
import { cleanQuoteDoc, CONTENT_FIELDS } from "./quoteDoc";
import { yjsStore } from "@/lib/yjsStore";

beforeEach(async () => {
  await yjsStore.resetForTests();
  setJobMeta("s1", { status: "done" });
  saveQuoteItem("s1", { id: "q", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 1000, order: 0 });
});

const job = () => getJobs().get("s1")!;

describe("zaliczka w dokumencie wyceny (5.3)", () => {
  it("czyszczenie: kwota dodatnia do dwóch miejsc, zła znika, a zaliczka zmienia treść dla klienta", () => {
    expect(cleanQuoteDoc({ deposit: 250.555, depositPaid: 100 })).toEqual({ deposit: 250.56, depositPaid: 100 });
    expect(cleanQuoteDoc({ deposit: -5, depositPaid: "dużo" })).toBeNull();
    expect(CONTENT_FIELDS).toContain("deposit");
    expect(CONTENT_FIELDS).not.toContain("depositPaid");
  });

  it("sumy: wpłacona zaliczka pomniejsza „do zapłaty”, nie więcej niż kwota, a „Niezapłacone” ją uwzględnia", () => {
    const base: Job = { status: "done", statusAt: 1, created: 1, items: [{ id: "a", kind: "labor", name: "x", qty: 1, unit: "usł.", price: 1000, order: 0 }] };
    expect(quoteSummary(base)).toMatchObject({ payable: 1000, paid: 0, due: 1000 });
    expect(quoteSummary({ ...base, doc: { depositPaid: 300 } })).toMatchObject({ paid: 300, due: 700 });
    expect(quoteSummary({ ...base, doc: { depositPaid: 5000 } })).toMatchObject({ paid: 1000, due: 0 });
    // Zaliczka tylko zażądana (jeszcze niewpłacona) niczego nie odejmuje.
    expect(quoteSummary({ ...base, doc: { deposit: 400 } })).toMatchObject({ paid: 0, due: 1000 });
    expect(unpaidTotal([{ ...base, doc: { depositPaid: 300 } }, { ...base, status: "paid", doc: { depositPaid: 300 } }])).toBe(700);
  });

  it("z rabatem i VAT: zaliczka odejmowana od kwoty brutto do zapłaty", () => {
    const j: Job = { status: "done", statusAt: 1, created: 1, items: [{ id: "a", kind: "labor", name: "x", qty: 1, unit: "usł.", price: 1000, order: 0 }], doc: { discount: 10, vatMode: "net", vatRate: 23, depositPaid: 500 } };
    expect(quoteSummary(j)).toMatchObject({ payable: 1107, paid: 500, due: 607 });
  });
});

describe("receiveDeposit i revertDeposit", () => {
  it("bez zaliczki w wycenie nie zapisuje nic", () => {
    expect(receiveDeposit("s1", job(), "2026-11-13")).toBe(false);
    expect(getSiteBilling("s1").payments).toEqual([]);
  });

  it("zapisuje wpłatę w rozliczeniach pod stałym id z numerem wyceny i kwotę w dokumencie", () => {
    setQuoteDoc("s1", { number: "W/A/2026/001", deposit: 300 });
    expect(receiveDeposit("s1", job(), "2026-11-13")).toBe(true);
    expect(getSiteBilling("s1").payments).toEqual([{ id: DEPOSIT_PAYMENT_ID, day: "2026-11-13", amount: 300, note: "Zaliczka — W/A/2026/001" }]);
    expect(job().doc?.depositPaid).toBe(300);
    expect(quoteSummary(job())).toMatchObject({ paid: 300, due: 700 });
  });

  it("ponowne kliknięcie nie dubluje wpłaty, a zmiana kwoty zaliczki aktualizuje tę samą wpłatę", () => {
    setQuoteDoc("s1", { deposit: 300 });
    receiveDeposit("s1", job(), "2026-11-13");
    receiveDeposit("s1", job(), "2026-11-14");
    expect(getSiteBilling("s1").payments).toHaveLength(1);
    setQuoteDoc("s1", { deposit: 400 });
    receiveDeposit("s1", job(), "2026-11-15");
    expect(getSiteBilling("s1").payments).toEqual([expect.objectContaining({ amount: 400, day: "2026-11-15" })]);
    expect(job().doc?.depositPaid).toBe(400);
  });

  it("cofnięcie usuwa wpłatę i kwotę z dokumentu, zostawia zażądaną zaliczkę", () => {
    setQuoteDoc("s1", { deposit: 300 });
    receiveDeposit("s1", job(), "2026-11-13");
    revertDeposit("s1");
    expect(getSiteBilling("s1").payments).toEqual([]);
    expect(job().doc).toEqual({ deposit: 300 });
  });

  it("zmiana zażądanej zaliczki unieważnia podpis, wpłata zaliczki — nie", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_000);
      setQuoteDoc("s1", { deposit: 300 });
      expect(job().changedAt).toBe(1_000);
      vi.setSystemTime(2_000);
      receiveDeposit("s1", job(), "2026-11-13");
      expect(job().changedAt).toBe(1_000);
      vi.setSystemTime(3_000);
      setQuoteDoc("s1", { deposit: 350 });
      expect(job().changedAt).toBe(3_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
