import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cleanSeries, findDuplicateNumbers, findGaps, formatInvoiceNumber, nextInvoiceNumber, parseInvoiceNumber } from "./numbering";
import { cleanRecord, createYInvoices, sha256Hex, verifyRecord, type InvoiceRecord } from "./yInvoices";
import { buildFa3Xml } from "./fa3";
import type { Invoice } from "./invoice";
import { getInvoices, issueInvoice } from "./invoicesStore";
import { seriesStore, setSeries } from "./sellerPrefs";

const draft = (): Omit<Invoice, "number"> => ({
  issueDate: "2026-11-11", saleDate: "2026-11-10",
  seller: { name: "Jan Kowalski", nip: "5260250274", address1: "ul. Lipowa 5" },
  buyer: { name: "Anna Nowak", nip: "", address1: "ul. Polna 2" },
  priceMode: "gross",
  lines: [{ name: "Wymiana baterii", unit: "szt.", qtyMilli: 1000, unitPrice: 12300, rate: 8 }],
});

async function record(id: string, number: string, issuedAt = 1_800_000_000_000): Promise<InvoiceRecord> {
  const invoice: Invoice = { ...draft(), number };
  const xml = buildFa3Xml(invoice, issuedAt);
  return { id, number, issuedAt, siteId: "lipowa-5", invoice, xml, hash: await sha256Hex(xml), device: "A" };
}

describe("numeracja", () => {
  it("format, parsowanie i czyszczenie serii", () => {
    expect(cleanSeries("b")).toBe("B");
    expect(cleanSeries("ąę-12 ab!cdefghij")).toBe("12ABCD");
    expect(cleanSeries("")).toBe("A");
    expect(formatInvoiceNumber("A", 2026, 7)).toBe("FV/A/2026/007");
    expect(parseInvoiceNumber("FV/B/2026/1042")).toEqual({ series: "B", year: 2026, seq: 1042 });
    expect(parseInvoiceNumber("coś/innego")).toBeNull();
  });

  it("następny numer: największy w serii i roku + 1, inne serie i lata nie wpływają", () => {
    const all = ["FV/A/2026/001", "FV/A/2026/002", "FV/B/2026/009", "FV/A/2025/050"];
    expect(nextInvoiceNumber("A", 2026, all)).toBe("FV/A/2026/003");
    expect(nextInvoiceNumber("B", 2026, all)).toBe("FV/B/2026/010");
    expect(nextInvoiceNumber("A", 2027, all)).toBe("FV/A/2027/001");
    expect(nextInvoiceNumber("C", 2026, [])).toBe("FV/C/2026/001");
  });

  it("duplikaty i luki", () => {
    expect(findDuplicateNumbers(["FV/A/2026/001", "FV/A/2026/002", "FV/A/2026/001"])).toEqual(["FV/A/2026/001"]);
    expect(findGaps("A", 2026, ["FV/A/2026/001", "FV/A/2026/002", "FV/A/2026/004"])).toEqual([3]);
    expect(findGaps("A", 2026, [])).toEqual([]);
  });
});

describe("magazyn faktur (Yjs)", () => {
  it("rekord po zapisie jest niezmienny: ponowny zapis tego samego id jest odrzucony", async () => {
    const y = createYInvoices(new Y.Doc());
    const r = await record("i1", "FV/A/2026/001");
    expect(y.add(r)).toBe(true);
    expect(y.add({ ...r, number: "FV/A/2026/999" })).toBe(false);
    expect(y.get("i1")?.number).toBe("FV/A/2026/001");
  });

  it("odrzuca rekord z błędnym skrótem, bez XML, z niepoprawną fakturą", async () => {
    const r = await record("i2", "FV/A/2026/002");
    expect(cleanRecord({ ...r, hash: "zły" })).toBeNull();
    expect(cleanRecord({ ...r, xml: "" })).toBeNull();
    expect(cleanRecord({ ...r, invoice: { ...r.invoice, lines: [] } })).toBeNull();
    expect(cleanRecord({ ...r, id: "" })).toBeNull();
    expect(cleanRecord(null)).toBeNull();
  });

  it("verifyRecord wykrywa zmianę XML po wystawieniu", async () => {
    const r = await record("i3", "FV/A/2026/003");
    expect(await verifyRecord(r)).toBe(true);
    expect(await verifyRecord({ ...r, xml: r.xml.replace("123.00", "1.00") })).toBe(false);
  });

  it("dwa telefony wystawiają różne faktury: po wymianie są obie; kopia nie nadpisuje istniejących", async () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYInvoices(a);
    const yb = createYInvoices(b);
    ya.add(await record("ia", "FV/A/2026/001", 1_800_000_000_000));
    yb.add(await record("ib", "FV/B/2026/001", 1_800_000_100_000));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(ya.all().map((r) => r.id)).toEqual(["ib", "ia"]);
    expect(yb.all()).toHaveLength(2);

    const evil = { ...(await record("ia", "FV/A/2026/777")), id: "ia" };
    ya.mergeDump({ invoices: [evil, await record("ic", "FV/A/2026/002", 1_800_000_200_000), { id: "x" }] });
    expect(ya.get("ia")?.number).toBe("FV/A/2026/001");
    expect(ya.get("ic")?.number).toBe("FV/A/2026/002");
    expect(ya.all()).toHaveLength(3);
  });
});

describe("wystawianie faktury", () => {
  beforeEach(() => { localStorage.clear(); setSeries("A"); });

  it("nadaje numer z serii urządzenia, składa XML i zapisuje skrót; kolejna faktura ma następny numer", async () => {
    const now = new Date(2026, 10, 11, 12).getTime();
    const first = await issueInvoice("lipowa-5", draft(), now);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.record.number).toBe("FV/A/2026/001");
    expect(first.record.xml).toContain("<P_2>FV/A/2026/001</P_2>");
    expect(await verifyRecord(first.record)).toBe(true);
    const second = await issueInvoice("lipowa-5", draft(), now + 1000);
    expect(second.ok && second.record.number).toBe("FV/A/2026/002");
    setSeries("B");
    expect(seriesStore.get()).toBe("B");
    const third = await issueInvoice("lipowa-5", draft(), now + 2000);
    expect(third.ok && third.record.number).toBe("FV/B/2026/001");
    expect(getInvoices().map((r) => r.number)).toEqual(expect.arrayContaining(["FV/A/2026/001", "FV/A/2026/002", "FV/B/2026/001"]));
  });

  it("niepoprawna faktura nie zużywa numeru ani nie trafia do magazynu", async () => {
    const before = getInvoices().length;
    const bad = await issueInvoice("lipowa-5", { ...draft(), seller: { name: "X", nip: "123", address1: "a" } });
    expect(bad.ok).toBe(false);
    expect(getInvoices().length).toBe(before);
  });
});
