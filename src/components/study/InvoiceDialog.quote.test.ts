import { describe, expect, it } from "vitest";
import { linesFromJob } from "./InvoiceDialog";
import { computeInvoice } from "@/lib/ksef/invoice";
import { quoteSummary, type Job } from "@/lib/study/jobs";

// Plan wycen i klientów, ryzyko „VAT na wycenie a faktura”: suma faktury z tych samych pozycji ma zgadzać się z kwotą
// z wyceny co do grosza przy całkowitych cenach po rabacie, a przy ułamkowych różnić się najwyżej o grosze na pozycję.

const item = (id: string, price: number, qty = 1, kind: "labor" | "material" = "labor") => ({ id, kind, name: id, qty, unit: "szt.", price, order: 0 });
const job = (over: Partial<Job>): Job => ({ status: "done", statusAt: 1, created: 1, items: [], ...over });
const grosze = (zl: number) => Math.round(zl * 100);

describe("suma faktury z wyceny (3.2)", () => {
  it("ceny netto + VAT 23% z rabatem 10%: brutto faktury = kwota do zapłaty z wyceny", () => {
    const j = job({ items: [item("a", 500, 2), item("b", 200)], doc: { discount: 10, vatMode: "net", vatRate: 23 } });
    const s = quoteSummary(j);
    const inv = computeInvoice({ lines: linesFromJob(j, 23), priceMode: "net" });
    // 2 × 500 + 200 = 1200, rabat 10% → netto 1080, VAT 248,40, brutto 1328,40.
    expect(s.payable).toBe(1328.4);
    expect(inv.gross).toBe(grosze(s.payable));
    expect(inv.net).toBe(grosze(s.net!));
    expect(inv.vat).toBe(grosze(s.vat!));
  });

  it("ceny brutto z VAT 8%: faktura ma tyle samo brutto i netto co wycena", () => {
    const j = job({ items: [item("a", 123, 3), item("b", 50)], doc: { vatMode: "gross", vatRate: 8 } });
    const s = quoteSummary(j);
    const inv = computeInvoice({ lines: linesFromJob(j, 8), priceMode: "gross" });
    expect(inv.gross).toBe(grosze(s.payable));
    expect(Math.abs(inv.net - grosze(s.net!))).toBeLessThanOrEqual(1);
  });

  it("rabat z ułamkową ceną po rabacie: różnica najwyżej grosz na pozycję", () => {
    const items = [item("a", 33.33, 3), item("b", 19.99, 7), item("c", 7.77, 11, "material")];
    const j = job({ margin: 15, items, doc: { discount: 7.5, vatMode: "net", vatRate: 23 } });
    const s = quoteSummary(j);
    const inv = computeInvoice({ lines: linesFromJob(j, 23), priceMode: "net" });
    // Cena jednostkowa zaokrąglana do grosza: błąd ≤ ilość × 0,5 gr na pozycję, potem VAT liczony od sumy.
    const tolerance = items.reduce((n, i) => n + Math.ceil(i.qty * 0.5), 0) * 1.23 + 1;
    expect(Math.abs(inv.gross - grosze(s.payable))).toBeLessThanOrEqual(tolerance);
  });

  it("bez dokumentu: faktura jak dotąd — ceny pozycji bez zmian", () => {
    const j = job({ items: [item("a", 100, 2)] });
    expect(linesFromJob(j, 23)[0]).toMatchObject({ unitPrice: 10000, qtyMilli: 2000, rate: 23 });
    expect(computeInvoice({ lines: linesFromJob(j, 23), priceMode: "gross" }).gross).toBe(grosze(quoteSummary(j).payable));
  });
});
