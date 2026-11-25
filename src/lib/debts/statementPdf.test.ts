import { beforeEach, describe, expect, it, vi } from "vitest";

// Atrapa jsPDF jak w `pdfBuilders.test.ts`: zapisuje tekst, który trafia na stronę.
const rec = vi.hoisted(() => ({ texts: [] as string[], pages: 1 }));

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
    output() { return new Blob(["%PDF-fake"], { type: "application/pdf" }); }
  },
}));

import { buildDebtStatementPdf, debtStatementPdfName } from "./statementPdf";
import { balances, type DebtEntry } from "./model";

beforeEach(() => { rec.texts = []; rec.pages = 1; });
const has = (re: RegExp) => rec.texts.some((t) => re.test(t));

const e = (over: Partial<DebtEntry>): DebtEntry => ({ id: "1", person: "Ania", kind: "lent", amount: 10_000, at: "2026-10-01", note: "", created: 1, ...over });

describe("buildDebtStatementPdf (L4.4)", () => {
  it("osoba, stan na dzień, saldo i wpisy od najnowszego z saldem po każdym", async () => {
    const [ania] = balances([e({}), e({ id: "2", kind: "repaid", amount: 2_550, at: "2026-10-05", created: 2, note: "BLIK" })]);
    const blob = await buildDebtStatementPdf(ania, "2026-11-25");
    expect(blob.type).toBe("application/pdf");
    expect(has(/^Rozliczenie$/)).toBe(true);
    expect(has(/^Ania$/)).toBe(true);
    expect(has(/Stan na 25\.11\.2026/)).toBe(true);
    expect(has(/^Do oddania: 74,50 zł$/)).toBe(true);
    const newest = rec.texts.findIndex((t) => t.startsWith("05.10.2026 · Oddał mi · 25,50 zł · BLIK"));
    const oldest = rec.texts.findIndex((t) => t.startsWith("01.10.2026 · Pożyczyłem · 100,00 zł"));
    expect(newest).toBeGreaterThan(-1);
    expect(oldest).toBeGreaterThan(newest);
    expect(rec.texts[newest + 1]).toBe("saldo po wpisie: 74,50 zł");
  });

  it("nazwa pliku z osobą, bez znaków zakazanych w systemach plików", () => {
    expect(debtStatementPdfName("Ania/Kowalska")).toBe("Rozliczenie - Ania Kowalska.pdf");
  });
});
