import { describe, expect, it } from "vitest";
import { isValidNip, normalizeNip } from "./nip";
import { escapeXml, stripInvalidXml } from "./xml";
import { computeInvoice, qtyToDecimal, roundHalfUp, toDecimal, validateInvoice, type Invoice } from "./invoice";
import { buildFa3Xml, invoiceFileName, utcStamp } from "./fa3";

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  number: "FV/A/2026/11/001", issueDate: "2026-11-11", saleDate: "2026-11-10",
  seller: { name: "Jan Kowalski Hydraulik", nip: "5260250274", address1: "ul. Lipowa 5", address2: "30-001 Kraków" },
  buyer: { name: "Anna Nowak", nip: "", address1: "ul. Polna 2" },
  priceMode: "gross",
  lines: [{ name: "Wymiana baterii", unit: "szt.", qtyMilli: 1000, unitPrice: 12300, rate: 8 }],
  ...over,
});

describe("NIP", () => {
  it("poprawny NIP z sumą kontrolną, normalizacja kresek i prefiksu PL", () => {
    expect(isValidNip("5260250274")).toBe(true);
    expect(isValidNip("526-025-02-74")).toBe(true);
    expect(isValidNip("PL 526 025 02 74")).toBe(true);
    expect(normalizeNip("PL526-025-02-74")).toBe("5260250274");
  });
  it("odrzuca zły checksum, długość i litery", () => {
    expect(isValidNip("5260250275")).toBe(false);
    expect(isValidNip("526025027")).toBe(false);
    expect(isValidNip("52602502741")).toBe(false);
    expect(isValidNip("52602502A4")).toBe(false);
    expect(isValidNip("")).toBe(false);
  });
});

describe("XML: escapowanie", () => {
  it("encje i usunięcie znaków niedozwolonych w XML 1.0", () => {
    expect(escapeXml(`a & b < c > d " e '`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos;");
    expect(stripInvalidXml("a\u0000b\u0008c\u000bd￾e")).toBe("abcde");
    expect(stripInvalidXml("tab\tnl\ncr\r")).toBe("tab\tnl\ncr\r");
    expect(stripInvalidXml("zażółć 😀")).toBe("zażółć 😀");
    expect(stripInvalidXml("sam\ud800surogat")).toBe("samsurogat");
  });
  it("tekst z próbą wstrzyknięcia węzła/komentarza/CDATA nie tworzy elementów", () => {
    const evil = "</P_7><x/><!-- --><![CDATA[ y ]]>";
    const xml = buildFa3Xml(invoice({ lines: [{ name: evil, unit: "szt.", qtyMilli: 1000, unitPrice: 100, rate: 23 }] }), 0);
    expect(xml).not.toContain("<x/>");
    expect(xml).not.toContain("<!--");
    expect(xml).not.toContain("<![CDATA[");
    expect(xml).toContain("&lt;/P_7&gt;&lt;x/&gt;");
    expect((xml.match(/<P_7>/g) ?? []).length).toBe(1);
  });
});

describe("kwoty w groszach", () => {
  it("zaokrąglenie half-up i formaty dziesiętne", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(1.004999)).toBe(1);
    expect(toDecimal(123450)).toBe("1234.50");
    expect(toDecimal(5)).toBe("0.05");
    expect(toDecimal(0)).toBe("0.00");
    expect(qtyToDecimal(1500)).toBe("1.5");
    expect(qtyToDecimal(1000)).toBe("1");
    expect(qtyToDecimal(250)).toBe("0.25");
  });

  it("ceny brutto: brutto z cennika zostaje co do grosza, VAT = brutto − netto", () => {
    const t = computeInvoice(invoice());
    // 123,00 zł brutto przy 8%: netto 113,89, VAT 9,11
    expect(t.gross).toBe(12300);
    expect(t.byRate).toEqual([{ rate: 8, net: 11389, vat: 911, gross: 12300 }]);
  });

  it("ceny netto: VAT liczony raz na stawkę od sumy netto", () => {
    const t = computeInvoice(invoice({ priceMode: "net", lines: [
      { name: "A", unit: "szt.", qtyMilli: 3000, unitPrice: 333, rate: 23 },
      { name: "B", unit: "szt.", qtyMilli: 1000, unitPrice: 333, rate: 23 },
    ] }));
    // netto 4 × 3,33 = 13,32; VAT 23% = 3,06 (zaokrąglone raz), brutto 16,38
    expect(t.byRate).toEqual([{ rate: 23, net: 1332, vat: 306, gross: 1638 }]);
  });

  it("kilka stawek: sumy per stawka i suma ogółem; ilości ułamkowe", () => {
    const t = computeInvoice(invoice({ priceMode: "net", lines: [
      { name: "Robocizna", unit: "godz.", qtyMilli: 2500, unitPrice: 10000, rate: 23 },
      { name: "Materiał", unit: "szt.", qtyMilli: 1000, unitPrice: 5000, rate: 8 },
      { name: "Bez VAT", unit: "szt.", qtyMilli: 1000, unitPrice: 1000, rate: 0 },
    ] }));
    expect(t.byRate.map((r) => r.rate)).toEqual([23, 8, 0]);
    expect(t.net).toBe(25000 + 5000 + 1000);
    expect(t.vat).toBe(5750 + 400);
    expect(t.gross).toBe(t.net + t.vat);
  });
});

describe("walidacja przed wystawieniem", () => {
  it("poprawna faktura nie ma problemów", () => {
    expect(validateInvoice(invoice())).toEqual([]);
  });
  it("zły NIP sprzedawcy, pusta lista, zła data, zła ilość i cena", () => {
    const fields = validateInvoice(invoice({ seller: { name: "X", nip: "123", address1: "a" }, lines: [], issueDate: "2026-13-40" })).map((p) => p.field);
    expect(fields).toEqual(expect.arrayContaining(["seller.nip", "lines", "issueDate"]));
    const bad = validateInvoice(invoice({ lines: [{ name: " ", unit: "", qtyMilli: 0, unitPrice: -1, rate: 7 as never }] })).map((p) => p.field);
    expect(bad).toEqual(expect.arrayContaining(["lines.0.name", "lines.0.unit", "lines.0.qty", "lines.0.price", "lines.0.rate"]));
  });
  it("NIP nabywcy: pusty (konsument) wolno, błędny nie", () => {
    expect(validateInvoice(invoice({ buyer: { name: "Firma", nip: "1234563218", address1: "" } }))).toEqual([]);
    expect(validateInvoice(invoice({ buyer: { name: "Firma", nip: "1234563219", address1: "" } })).map((p) => p.field)).toContain("buyer.nip");
  });
});

describe("XML FA(3)", () => {
  const xml = buildFa3Xml(invoice(), Date.UTC(2026, 10, 11, 10, 15, 30));

  it("nagłówek i kolejność sekcji jak w schemacie", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">')).toBe(true);
    expect(xml).toContain('<KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza><WariantFormularza>3</WariantFormularza><DataWytworzeniaFa>2026-11-11T10:15:30Z</DataWytworzeniaFa>');
    const order = ["<Naglowek>", "<Podmiot1>", "<Podmiot2>", "<Fa>", "<P_15>", "<Adnotacje>", "<RodzajFaktury>", "<FaWiersz>"].map((t) => xml.indexOf(t));
    expect(order.every((v) => v >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("konsument bez NIP dostaje BrakID, firma NIP; JST i GV = 2", () => {
    expect(xml).toContain("<BrakID>1</BrakID>");
    const company = buildFa3Xml(invoice({ buyer: { name: "Firma", nip: "123-456-32-18", address1: "ul. X" } }), 0);
    expect(company).toContain("<Podmiot2><DaneIdentyfikacyjne><NIP>1234563218</NIP>");
    expect(company).toContain("<JST>2</JST><GV>2</GV>");
  });

  it("kwoty: P_13/P_14 per stawka, P_15 ogółem, pozycja z ceną brutto (P_9B, P_11A)", () => {
    expect(xml).toContain("<P_13_2>113.89</P_13_2><P_14_2>9.11</P_14_2>");
    expect(xml).toContain("<P_15>123.00</P_15>");
    expect(xml).toContain("<P_9B>123.00</P_9B><P_11A>123.00</P_11A><P_12>8</P_12>");
  });

  it("0% krajowa: P_13_6_1 bez kwoty podatku, stawka „0 KR”", () => {
    const x = buildFa3Xml(invoice({ priceMode: "net", lines: [{ name: "Usługa", unit: "szt.", qtyMilli: 1000, unitPrice: 5000, rate: 0 }] }), 0);
    expect(x).toContain("<P_13_6_1>50.00</P_13_6_1>");
    expect(x).not.toContain("<P_14_");
    expect(x).toContain("<P_12>0 KR</P_12>");
  });

  it("płatność: przelew z rachunkiem i terminem, gotówka bez rachunku", () => {
    const x = buildFa3Xml(invoice({ payment: { form: 6, dueDate: "2026-11-25", account: "PL61 1090 1014 0000 0712 1981 2874" } }), 0);
    expect(x).toContain("<Platnosc><TerminPlatnosci><Termin>2026-11-25</Termin></TerminPlatnosci><FormaPlatnosci>6</FormaPlatnosci><RachunekBankowy><NrRB>PL61109010140000071219812874</NrRB></RachunekBankowy></Platnosc>");
    const cash = buildFa3Xml(invoice({ payment: { form: 1, account: "PL61 1090" } }), 0);
    expect(cash).toContain("<Platnosc><FormaPlatnosci>1</FormaPlatnosci></Platnosc>");
  });

  it("czas UTC i nazwa pliku bez znaków ze ścieżek", () => {
    expect(utcStamp(Date.UTC(2026, 0, 2, 3, 4, 5, 678))).toBe("2026-01-02T03:04:05Z");
    expect(invoiceFileName("FV/A/2026/11/001")).toBe("FV-A-2026-11-001.xml");
    expect(invoiceFileName("a/b\\c:d")).not.toMatch(/[\\/:]/);
    expect(invoiceFileName("///")).toBe("faktura.xml");
  });
});
