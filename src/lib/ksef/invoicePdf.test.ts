import { beforeEach, describe, expect, it, vi } from "vitest";

// Atrapa jsPDF (jak w pdfBuilders.test.ts): zapisuje tekst i obrazy trafiające na stronę.
const rec = vi.hoisted(() => ({ texts: [] as string[], images: 0, pages: 1 }));
vi.mock("jspdf", () => ({
  default: class FakeJsPdf {
    addFont() {}
    setFont() {}
    setFontSize() {}
    getTextWidth() { return 10; }
    splitTextToSize(t: string) { return [t]; }
    text(t: string) { rec.texts.push(String(t)); }
    addPage() { rec.pages += 1; }
    getNumberOfPages() { return rec.pages; }
    setPage() {}
    getImageProperties() { return { width: 100, height: 100 }; }
    addImage() { rec.images += 1; }
    output() { return new Blob(["%PDF-fake"], { type: "application/pdf" }); }
  },
}));
vi.mock("./qr", async (orig) => ({ ...(await orig<typeof import("./qr")>()), qrPngDataUrl: vi.fn(async () => "data:image/png;base64,AAAA") }));

import { buildInvoicePdf, invoicePdfName } from "./invoicePdf";
import { buildFa3Xml } from "./fa3";
import { hexToBase64Url, invoiceQrUrl } from "./qr";
import { sha256Hex, type InvoiceRecord } from "./yInvoices";
import type { Invoice } from "./invoice";

beforeEach(() => { rec.texts = []; rec.images = 0; rec.pages = 1; });

async function record(): Promise<InvoiceRecord> {
  const invoice: Invoice = {
    number: "FV/A/2026/001", issueDate: "2026-11-11", saleDate: "2026-11-10",
    seller: { name: "Jan Kowalski Hydraulik", nip: "5260250274", address1: "ul. Lipowa 5", address2: "30-001 Kraków" },
    buyer: { name: "Anna Nowak", nip: "", address1: "ul. Polna 2" },
    priceMode: "gross",
    lines: [{ name: "Wymiana baterii", unit: "szt.", qtyMilli: 1000, unitPrice: 12300, rate: 8 }],
    payment: { form: 6, dueDate: "2026-11-25", account: "PL61109010140000071219812874" },
  };
  const xml = buildFa3Xml(invoice, 1_800_000_000_000);
  return { id: "i1", number: invoice.number, issuedAt: 1_800_000_000_000, siteId: "lipowa-5", invoice, xml, hash: await sha256Hex(xml) };
}

describe("kod QR faktury", () => {
  it("hex SHA-256 → Base64URL bez dopełnienia (wektor SHA-256(\"abc\"))", () => {
    expect(hexToBase64Url("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });

  it("adres KODU I: NIP, data DD-MM-RRRR z P_1 i skrót XML", async () => {
    const r = await record();
    const url = invoiceQrUrl(r);
    expect(url.startsWith("https://qr.ksef.mf.gov.pl/invoice/5260250274/11-11-2026/")).toBe(true);
    expect(url.endsWith(hexToBase64Url(r.hash))).toBe(true);
    expect(url).not.toMatch(/[+/=]$/);
  });
});

describe("PDF faktury", () => {
  it("zawiera numer, strony, pozycję, podsumowanie, płatność, kod QR i skrót", async () => {
    const r = await record();
    const blob = await buildInvoicePdf(r);
    expect(blob.size).toBeGreaterThan(0);
    const has = (re: RegExp) => rec.texts.some((t) => re.test(t));
    expect(has(/^Nr FV\/A\/2026\/001$/)).toBe(true);
    expect(has(/Data wystawienia: 11\.11\.2026/)).toBe(true);
    expect(has(/Jan Kowalski Hydraulik/)).toBe(true);
    expect(has(/NIP: 5260250274/)).toBe(true);
    expect(has(/1\. Wymiana baterii — 1 szt\. × 123/)).toBe(true);
    expect(has(/Razem do zapłaty: 123/)).toBe(true);
    expect(has(/Forma: przelew.*Termin: 25\.11\.2026/)).toBe(true);
    expect(has(/Rachunek: PL61109010140000071219812874/)).toBe(true);
    expect(has(/^OFFLINE$/)).toBe(true);
    expect(has(new RegExp(r.hash))).toBe(true);
    expect(rec.images).toBe(1);
  });

  it("nazwa pliku", () => {
    expect(invoicePdfName("FV/A/2026/001")).toBe("Faktura - FV A 2026 001.pdf");
  });
});
