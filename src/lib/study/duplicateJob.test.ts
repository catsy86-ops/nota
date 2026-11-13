import { beforeEach, describe, expect, it, vi } from "vitest";
import { copyName, duplicateJob } from "./duplicateJob";
import { getJobs, saveQuoteItem, setJobMeta, setQuoteDoc } from "./jobsStore";
import { resetStudyForTests } from "./data";
import { getStudy, saveSiteCard, siteDirectoryOf } from "./store";
import { addClient, getClientLinks, linkSiteToClient } from "@/lib/clients/store";
import { yjsStore } from "@/lib/yjsStore";
import type { SiteInfo } from "./sites";

beforeEach(async () => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 13, 12));
  await yjsStore.resetForTests();
  resetStudyForTests();
});

const dir = () => siteDirectoryOf(getStudy());
let n = 0;
const newId = () => `copy-${++n}`;

function source() {
  saveSiteCard("src", { name: "Lipowa 5", address: "ul. Lipowa 5", investor: "Jan Kowalski", phone: "600 100 200" });
  setJobMeta("src", { status: "done", scope: "Wymiana baterii", margin: 15, term: "2026-11-20T10:00" });
  saveQuoteItem("src", { id: "b", kind: "material", name: "Bateria", qty: 1, unit: "szt.", price: 250, order: 1 });
  saveQuoteItem("src", { id: "a", kind: "labor", name: "Montaż", qty: 2, unit: "usł.", price: 100, order: 0 });
  setQuoteDoc("src", { number: "W/A/2026/001", issued: "2026-11-13", validUntil: "2026-12-01", sentAt: 5, acceptedAt: 9, discount: 10, vatMode: "net", vatRate: 8, notes: "Zaliczka 30%." });
  return dir().find((s) => s.id === "src")!;
}

describe("copyName", () => {
  const s = (name: string) => ({ id: name, name }) as Pick<SiteInfo, "id" | "name">;
  it("pierwsza wolna nazwa z numerem, bez ogonków i wielkości liter przy porównaniu", () => {
    expect(copyName("Lipowa 5", [])).toBe("Lipowa 5 (kopia)");
    expect(copyName("Lipowa 5", [s("lipowa 5 (KOPIA)")])).toBe("Lipowa 5 (kopia 2)");
    expect(copyName("Lipowa 5", [s("Lipowa 5 (kopia)"), s("Lipowa 5 (kopia 2)")])).toBe("Lipowa 5 (kopia 3)");
  });
  it("długa nazwa jest przycinana tak, by sufiks się zmieścił", () => {
    expect(copyName("x".repeat(120), []).length).toBeLessThanOrEqual(120);
    expect(copyName("x".repeat(120), []).endsWith(" (kopia)")).toBe(true);
  });
});

describe("duplicateJob (4.5)", () => {
  it("kopiuje pozycje, zakres, marżę, rabat, VAT i uwagi, ale nie numer, daty, stan ani termin", () => {
    const site = source();
    const copy = duplicateJob(site, getJobs().get("src")!, dir(), newId)!;
    expect(copy.name).toBe("Lipowa 5 (kopia)");
    const job = getJobs().get(copy.id)!;
    expect(job.status).toBe("quote");
    expect(job).toMatchObject({ scope: "Wymiana baterii", margin: 15 });
    expect(job.term).toBeUndefined();
    expect(job.items.map((i) => [i.name, i.qty, i.price, i.order])).toEqual([["Montaż", 2, 100, 0], ["Bateria", 1, 250, 1]]);
    expect(job.items.map((i) => i.id)).not.toContain("a");
    expect(job.doc).toEqual({ discount: 10, vatMode: "net", vatRate: 8, notes: "Zaliczka 30%." });
    // Oryginał nietknięty.
    expect(getJobs().get("src")?.doc?.number).toBe("W/A/2026/001");
    expect(getJobs().get("src")?.items).toHaveLength(2);
  });

  it("karta kopii ma dane klienta, a powiązanie z kartoteką jest to samo", () => {
    const site = source();
    const klient = addClient({ name: "Jan Kowalski" })!;
    linkSiteToClient("src", klient.id);
    const copy = duplicateJob(site, getJobs().get("src")!, dir(), newId)!;
    const card = dir().find((s) => s.id === copy.id)!;
    expect(card).toMatchObject({ address: "ul. Lipowa 5", investor: "Jan Kowalski", phone: "600 100 200" });
    expect(getClientLinks().get(copy.id)).toBe(klient.id);
  });

  it("wycena bez dokumentu i bez klienta: kopia ma tylko pozycje, a druga kopia dostaje następną nazwę", () => {
    saveSiteCard("plain", { name: "Prosta", address: "", investor: "" });
    setJobMeta("plain", { status: "quote" });
    saveQuoteItem("plain", { id: "x", kind: "labor", name: "Coś", qty: 1, unit: "usł.", price: 10, order: 0 });
    const site = dir().find((s) => s.id === "plain")!;
    const one = duplicateJob(site, getJobs().get("plain")!, dir(), newId)!;
    expect(getJobs().get(one.id)?.doc).toBeUndefined();
    expect(getClientLinks().has(one.id)).toBe(false);
    const two = duplicateJob(site, getJobs().get("plain")!, dir(), newId)!;
    expect(two.name).toBe("Prosta (kopia 2)");
    expect(getJobs().size).toBe(3);
  });
});
