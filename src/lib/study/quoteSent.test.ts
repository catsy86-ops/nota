import { beforeEach, describe, expect, it, vi } from "vitest";
import { getJobs, markQuoteSent, saveQuoteItem, setJobMeta, setQuoteDoc } from "./jobsStore";
import { siteMaterialUsage } from "./useSiteMaterialUsage";
import { quoteState } from "./quoteDoc";
import { yjsStore } from "@/lib/yjsStore";
import type { JournalEntry } from "./journalEntry";

// markQuoteSent: ponowny PDF nie zeruje licznika „wysłana N dni temu” (po przeglądzie simplify).

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(100);
  await yjsStore.resetForTests();
  setJobMeta("s1", { status: "quote" });
  saveQuoteItem("s1", { id: "q", kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 100, order: 0 });
});

const doc = () => getJobs().get("s1")?.doc;

describe("markQuoteSent", () => {
  it("pierwsze wysłanie ustawia datę, kolejne PDF-y jej nie przesuwają", () => {
    vi.setSystemTime(1_000);
    expect(markQuoteSent("s1")).toBe(true);
    expect(doc()?.sentAt).toBe(1_000);
    vi.setSystemTime(9_000);
    expect(markQuoteSent("s1")).toBe(false);
    expect(doc()?.sentAt).toBe(1_000);
  });

  it("zmiana treści po wysłaniu pozwala wysłać ponownie z nową datą", () => {
    vi.setSystemTime(1_000);
    markQuoteSent("s1");
    vi.setSystemTime(2_000);
    setQuoteDoc("s1", { discount: 10 });
    vi.setSystemTime(3_000);
    expect(markQuoteSent("s1")).toBe(true);
    expect(doc()?.sentAt).toBe(3_000);
  });

  it("po decyzji klienta ten sam PDF niczego nie zmienia, a zmieniona treść pozwala wysłać na nowo", () => {
    vi.setSystemTime(1_000);
    markQuoteSent("s1");
    vi.setSystemTime(1_500);
    setQuoteDoc("s1", { acceptedAt: 1_500 });
    expect(quoteState(doc())).toBe("accepted");
    // Ponowne pobranie podpisanej kopii nie cofa „przyjętej” do „wysłanej” i nie liczy drugiej wysyłki.
    vi.setSystemTime(4_000);
    expect(markQuoteSent("s1")).toBe(false);
    expect(quoteState(doc())).toBe("accepted");
    expect(doc()?.sentAt).toBe(1_000);
    // Po zmianie treści po decyzji klienta to nowa wycena do przyjęcia.
    vi.setSystemTime(5_000);
    setQuoteDoc("s1", { discount: 5 });
    vi.setSystemTime(6_000);
    expect(markQuoteSent("s1")).toBe(true);
    expect(quoteState(doc())).toBe("sent");
    expect(markQuoteSent("brak")).toBe(false);
  });
});

describe("siteMaterialUsage: pamięć ostatniego wyniku", () => {
  const journal: JournalEntry[] = [{
    id: "e1", at: 1, kind: "ok", topic: null, text: "x", site: "A", siteId: "s1", checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 2 }],
  }];
  const prices = { "kolano 16": 4 };

  it("to samo wejście daje ten sam obiekt, zmiana któregokolwiek składnika liczy od nowa", () => {
    const site = { id: "s1", shortages: undefined };
    const a = siteMaterialUsage(journal, site, prices);
    expect(siteMaterialUsage(journal, site, prices)).toBe(a);
    expect(a.cost).toBe(8);
    expect(siteMaterialUsage(journal, site, { "kolano 16": 5 })).not.toBe(a);
    expect(siteMaterialUsage([...journal], site, prices)).not.toBe(a);
    expect(siteMaterialUsage(journal, { id: "s2", shortages: undefined }, prices).months).toEqual([]);
  });
});
