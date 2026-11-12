import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cleanSeries, findDuplicateNumbers, findGaps, formatInvoiceNumber, nextInvoiceNumber, parseInvoiceNumber } from "./numbering";
import { cleanRecord, createYInvoices, sha256Hex, verifyRecord, type InvoiceRecord } from "./yInvoices";
import { buildFa3Xml } from "./fa3";
import type { Invoice } from "./invoice";
import { getInvoices, issueCorrection, issueInvoice } from "./invoicesStore";
import { computeInvoice } from "./invoice";
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
    expect(parseInvoiceNumber("FV/B/2026/1042")).toEqual({ kind: "FV", series: "B", year: 2026, seq: 1042 });
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

describe("faktura korygująca", () => {
  beforeEach(() => { localStorage.clear(); setSeries("A"); });
  const now = new Date(2026, 10, 12, 12).getTime();

  async function original() {
    const r = await issueInvoice("lipowa-5", draft(), now);
    if (!r.ok) throw new Error("brak faktury");
    return r.record; // 1 × 123,00 zł brutto, VAT 8%
  }

  it("numer FK ma własny licznik, nie rusza numeracji FV", async () => {
    const o = await original();
    const k1 = await issueCorrection(o, { lines: [{ ...o.invoice.lines[0], unitPrice: 10000 }], reason: "Rabat", type: 2, issueDate: "2026-11-12" }, now + 1000);
    const k2 = await issueCorrection(o, { lines: [], reason: "Anulowanie", type: 1, issueDate: "2026-11-12" }, now + 2000);
    if (!k1.ok || !k2.ok) throw new Error("korekty");
    const seq = (n: string) => Number(n.split("/")[3]);
    expect(k1.record.number).toMatch(/^FK\/A\/2026\/\d{3}$/);
    expect(seq(k2.record.number)).toBe(seq(k1.record.number) + 1);
    const nextFv = seq(o.number) + 1;
    const v = await issueInvoice("lipowa-5", draft(), now + 3000);
    expect(v.ok && seq(v.record.number)).toBeGreaterThanOrEqual(nextFv);
    expect(v.ok && v.record.number.startsWith("FV/")).toBe(true);
    expect(findGaps("A", 2026, getInvoices().map((r) => r.number), "FK")).toEqual([]);
  });

  it("sumy korekty to różnica po − przed, także ujemna; zmiana stawki daje wiersze obu stawek", async () => {
    const o = await original();
    const down = await issueCorrection(o, { lines: [{ ...o.invoice.lines[0], unitPrice: 10800 }], reason: "Rabat", type: 2, issueDate: "2026-11-12" }, now + 1);
    if (!down.ok) throw new Error("korekta");
    expect(computeInvoice(down.record.invoice).gross).toBe(-1500);
    const moved = computeInvoice({ priceMode: "gross", lines: [{ ...o.invoice.lines[0], rate: 23 }], correction: { ...down.record.invoice.correction!, linesBefore: o.invoice.lines } });
    expect(moved.byRate.map((r) => r.rate)).toEqual([23, 8]);
    expect(moved.byRate[1].gross).toBe(-12300);
    expect(moved.gross).toBe(0);
  });

  it("XML: KOR, dane korygowanej, stan przed i po jako osobne wiersze, różnice w P_15", async () => {
    const o = await original();
    const k = await issueCorrection(o, { lines: [{ ...o.invoice.lines[0], unitPrice: 10800 }], reason: "Rabat <10%>", type: 2, issueDate: "2026-11-12" }, now + 1);
    if (!k.ok) throw new Error("korekta");
    const x = k.record.xml;
    expect(x).toContain("<RodzajFaktury>KOR</RodzajFaktury>");
    expect(x).toContain("<PrzyczynaKorekty>Rabat &lt;10%&gt;</PrzyczynaKorekty><TypKorekty>2</TypKorekty>");
    expect(x).toContain(`<NrFaKorygowanej>${o.number}</NrFaKorygowanej><NrKSeFN>1</NrKSeFN>`);
    expect(x).toContain("<NrWierszaFa>1</NrWierszaFa>");
    expect(x).toContain("<NrWierszaFa>2</NrWierszaFa>");
    expect(x.match(/<StanPrzed>1<\/StanPrzed>/g)).toHaveLength(1);
    expect(x).toContain("<P_15>-15.00</P_15>");
    expect(await verifyRecord(k.record)).toBe(true);
    expect(cleanRecord(k.record)).not.toBeNull();
  });

  it("numer KSeF korygowanej trafia do XML; zły numer i brak przyczyny blokują wystawienie", async () => {
    const o = await original();
    const ksef = "5260250274-20261112-ABCDEF-123456-AB";
    const ok = await issueCorrection(o, { lines: [], reason: "Anulowanie", type: 1, issueDate: "2026-11-12", ksefNumber: ksef }, now + 1);
    expect(ok.ok && ok.record.xml).toContain(`<NrKSeF>1</NrKSeF><NrKSeFFaKorygowanej>${ksef}</NrKSeFFaKorygowanej>`);
    const bad = await issueCorrection(o, { lines: [], reason: " ", type: 1, issueDate: "2026-11-12", ksefNumber: "zły" }, now + 2);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.problems.map((p) => p.field)).toEqual(expect.arrayContaining(["correction.reason", "correction.ksef"]));
  });

  it("rekord z uszkodzoną korektą jest odrzucany", async () => {
    const o = await original();
    const k = await issueCorrection(o, { lines: [], reason: "x", type: 1, issueDate: "2026-11-12" }, now + 1);
    if (!k.ok) throw new Error("korekta");
    expect(cleanRecord({ ...k.record, invoice: { ...k.record.invoice, correction: { reason: "x" } } })).toBeNull();
    expect(cleanRecord({ ...k.record, invoice: { ...k.record.invoice, correction: null } })).toBeNull();
  });
});

describe("szyfrowany eksport faktur", () => {
  it("round-trip hasłem; złe hasło, zmieniony plik i obcy format są odrzucane", async () => {
    const { encryptInvoices, decryptInvoices } = await import("./invoiceExport");
    const rec = await record("e1", "FV/A/2026/501");
    const file = await encryptInvoices({ invoices: [rec] }, "kuchenny-zlew-2026", 1000);
    expect(JSON.stringify(file)).not.toContain("Anna Nowak");
    const back = await decryptInvoices(JSON.parse(JSON.stringify(file)), "kuchenny-zlew-2026", 1000);
    expect(back.invoices.map((r) => r.id)).toEqual(["e1"]);
    await expect(decryptInvoices(file, "inne-haslo-123456", 1000)).rejects.toMatchObject({ code: "decrypt-failed" });
    const tampered = { ...file, data: file.data.slice(0, -2) + (file.data.endsWith("AA") ? "BB" : "AA") };
    await expect(decryptInvoices(tampered, "kuchenny-zlew-2026", 1000)).rejects.toMatchObject({ code: "decrypt-failed" });
    await expect(decryptInvoices({ format: "x" }, "kuchenny-zlew-2026", 1000)).rejects.toMatchObject({ code: "bad-format" });
    await expect(decryptInvoices({ ...file, iter: 10 }, "kuchenny-zlew-2026", 1000)).rejects.toMatchObject({ code: "weak-params" });
  });

  it("słabe hasło przy pełnej liczbie iteracji jest odrzucone", async () => {
    const { encryptInvoices } = await import("./invoiceExport");
    await expect(encryptInvoices({ invoices: [] }, "krotkie")).rejects.toThrow("weak-password");
  });
});
