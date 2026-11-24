import { describe, expect, it } from "vitest";
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader, type FileEntry } from "@zip.js/zip.js";
import { buildFa3Xml } from "@/lib/ksef/fa3";
import type { Invoice } from "@/lib/ksef/invoice";
import type { InvoiceRecord } from "@/lib/ksef/yInvoices";
import { accountantPlan, buildAccountantZip, monthInvoices } from "./accountantExport";
import type { MileageEntry } from "./mileage";

const PASS = "Księgowa-listopad-2026!";

function record(id: string, number: string, issueDate: string, correction = false): InvoiceRecord {
  const invoice: Invoice = {
    number, issueDate, saleDate: issueDate,
    seller: { name: "Jan Kowalski", nip: "5260250274", address1: "ul. Lipowa 5" },
    buyer: { name: "Anna Nowak", nip: "", address1: "ul. Polna 2" },
    priceMode: "gross",
    lines: [{ name: "Wymiana baterii", unit: "szt.", qtyMilli: 1000, unitPrice: 12300, rate: 8 }],
    ...(correction ? { correction: { linesBefore: [{ name: "Wymiana baterii", unit: "szt.", qtyMilli: 1000, unitPrice: 50000, rate: 8 }], reason: "x", originalNumber: "FV/A/2026/001", originalIssueDate: "2026-11-02" } as unknown as Invoice["correction"] } : {}),
  };
  return { id, number, issuedAt: new Date(`${issueDate}T10:00:00`).getTime(), siteId: "lipowa", invoice, xml: buildFa3Xml(invoice, 1), hash: "h" };
}

const km = (day: string, distance: number): MileageEntry => ({ id: day, date: new Date(`${day}T12:00:00`).getTime(), siteIds: ["lipowa"], distance, rate: 1 });
const input = {
  monthKey: "2026-11",
  invoices: [record("b", "FV/A/2026/002", "2026-11-20"), record("a", "FV/A/2026/001", "2026-11-02"), record("old", "FV/A/2026/000", "2026-10-30")],
  mileage: [km("2026-11-03", 40), km("2026-10-31", 10)],
  siteName: (id: string) => (id === "lipowa" ? "Lipowa 5" : id),
};

describe("accountantExport", () => {
  it("bierze tylko faktury z miesiąca, od najstarszej", () => {
    expect(monthInvoices(input.invoices, "2026-11").map((r) => r.number)).toEqual(["FV/A/2026/001", "FV/A/2026/002"]);
  });

  it("rejestr, XML-e i kilometrówka tylko z miesiąca; sumy w rejestrze", () => {
    const plan = accountantPlan(input)!;
    const files = plan.texts;
    expect(plan.trips).toHaveLength(1);
    expect(files.map((f) => f.name)).toEqual([
      "rejestr-faktur-2026-11.csv", "faktury/FV-A-2026-001.xml", "faktury/FV-A-2026-002.xml", "kilometrowka-2026-11.csv",
    ]);
    const reg = files[0].text;
    expect(reg.startsWith("﻿")).toBe(true);
    expect(reg).toContain("FV/A/2026/001;2026-11-02");
    expect(reg).toMatch(/Razem;;;2;;[\d,]+;[\d,]+;246,00/);
    expect(files[3].text).toContain("Lipowa 5");
    expect(files[3].text).not.toContain("2026-10-31");
  });

  it("pusty miesiąc bez kilometrówki i zły miesiąc: brak planu", () => {
    expect(accountantPlan({ ...input, monthKey: "2026-09" })).toBeNull();
    expect(accountantPlan({ ...input, monthKey: "2026-13" })).toBeNull();
    expect(accountantPlan({ ...input, monthKey: "../x" })).toBeNull();
  });

  it("słabe hasło jest odrzucane", async () => {
    await expect(buildAccountantZip(accountantPlan(input)!, "123", async () => new Uint8Array())).rejects.toThrow("weak-password");
  });

  it("ZIP jest zaszyfrowany AES i otwiera się tylko z hasłem", async () => {
    const zip = await buildAccountantZip(accountantPlan(input)!, PASS, async (r) => new TextEncoder().encode(`PDF ${r.number}`));
    const entries = await new ZipReader(new Uint8ArrayReader(zip)).getEntries();
    expect(entries.map((e) => e.filename)).toContain("faktury/FV-A-2026-001.pdf");
    expect(entries.every((e) => e.encrypted && !e.zipCrypto)).toBe(true);
    const pdf = entries.find((e) => e.filename === "faktury/FV-A-2026-002.pdf") as FileEntry;
    await expect(pdf.getData(new Uint8ArrayWriter(), { password: "złe-hasło-123456" })).rejects.toThrow();
    expect(new TextDecoder().decode(await pdf.getData(new Uint8ArrayWriter(), { password: PASS }))).toBe("PDF FV/A/2026/002");
  });

  it("kwoty korekty bez apostrofu, powtórzone nazwy plików dostają numer", () => {
    const files = accountantPlan({ ...input, invoices: [record("k", "FV 1", "2026-11-25", true), record("s", "FV/1", "2026-11-26")] })!.texts;
    expect(files.map((f) => f.name)).toEqual(expect.arrayContaining(["faktury/FV-1.xml", "faktury/FV-1-2.xml"]));
    expect(files[0].text).toMatch(/;-\d+,\d{2};/);
    expect(files[0].text).not.toContain("'-");
  });

  it("hasło „Średnie” to za mało dla ZIP-a", async () => {
    await expect(buildAccountantZip(accountantPlan(input)!, "abcdefgh1234", async () => new Uint8Array())).rejects.toThrow("weak-password");
  });
});
