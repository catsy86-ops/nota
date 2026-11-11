import { beforeEach, describe, expect, it, vi } from "vitest";

// T6: PDF-y były sprawdzane tylko nagłówkiem i rozmiarem. Tu jsPDF jest atrapą, która zapisuje wszystko, co trafia na
// stronę — widać treść, numerację stron, zdjęcia i stopkę z odciskiem, bez uruchamiania prawdziwego generatora.
const rec = vi.hoisted(() => ({ texts: [] as string[], pages: 1, images: 0, current: 1 }));

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
    setPage(p: number) { rec.current = p; }
    getImageProperties() { return { width: 100, height: 50 }; }
    addImage() { rec.images += 1; }
    output() { return new Blob(["%PDF-fake"], { type: "application/pdf" }); }
  },
}));

import { buildBillingPdf } from "./billingPdf";
import { buildHandoverPdf } from "./handoverPdf";
import { PDF_PHOTOS_PER_PAGE } from "./pdfWriter";
import type { BillingStatement } from "./billing";
import { buildHandover } from "./handover";

beforeEach(() => { rec.texts = []; rec.pages = 1; rec.images = 0; rec.current = 1; });

const has = (re: RegExp) => rec.texts.some((t) => re.test(t));

describe("buildBillingPdf", () => {
  const st: BillingStatement = {
    lines: [{ label: "Godziny", detail: "10 h × 100 zł", amount: 1000 }] as never,
    accrued: 5000, paid: 2000, due: 3000, payments: [{ day: "2026-11-03", amount: 2000, note: "zaliczka" }] as never, warnings: ["Brak stawki za punkt"],
  };

  it("zawiera nazwę budowy, firmę, naliczone, wpłaty i kwotę do zapłaty", async () => {
    await buildBillingPdf("Lipowa 5", st, { company: "Hydro-Serwis", today: "2026-11-11" });
    expect(has(/^Hydro-Serwis$/)).toBe(true);
    expect(has(/^Lipowa 5$/)).toBe(true);
    expect(has(/Stan na 11\.11\.2026/)).toBe(true);
    expect(has(/Godziny: 10 h × 100 zł/)).toBe(true);
    expect(has(/03\.11\.2026: 2\D?000.*\(zaliczka\)/)).toBe(true);
    expect(has(/Zostało do zapłaty: 3\D?000/)).toBe(true);
    expect(has(/Brak stawki za punkt/)).toBe(true);
    expect(has(/Strona 1 z 1/)).toBe(true);
  });

  it("nadpłata zamiast „do zapłaty”, bez firmy nie ma jej nagłówka", async () => {
    await buildBillingPdf("Lipowa 5", { ...st, due: -150 }, { company: "  ", today: "2026-11-11" });
    expect(has(/Nadpłata: .*150/)).toBe(true);
    expect(has(/Zostało do zapłaty/)).toBe(false);
    expect(has(/Hydro/)).toBe(false);
  });
});

describe("buildHandoverPdf", () => {
  const h = buildHandover([], { id: "lipowa-5", name: "Lipowa 5", address: "ul. Lipowa 5", investor: "Jan Kowalski" }, new Date(2026, 9, 16, 12).getTime());
  const photo = (i: number) => ({ dataUrl: "data:image/png;base64,AAAA", caption: `zdjęcie ${i}` });

  it("nagłówek dokumentu, stopka z odciskiem na każdej stronie i numeracja zgodna z liczbą stron zdjęć", async () => {
    const count = PDF_PHOTOS_PER_PAGE + 1; // dwie strony zdjęć
    await buildHandoverPdf(h, { company: "", photos: Array.from({ length: count }, (_, i) => photo(i)), footer: "Odcisk dokumentu: 3F2A-91C0-77DD-B1E4-5A60-C2D9" });
    expect(has(/Protokół odbioru instalacji/)).toBe(true);
    expect(has(/Adres: ul\. Lipowa 5/)).toBe(true);
    expect(rec.images).toBe(count);
    const total = rec.pages;
    expect(total).toBeGreaterThanOrEqual(2);
    expect(rec.texts.filter((t) => t.startsWith("Odcisk dokumentu: 3F2A")).length).toBe(total);
    expect(has(new RegExp(`Strona ${total} z ${total}`))).toBe(true);
  });

  it("bez stopki w opcjach nie ma odcisku", async () => {
    await buildHandoverPdf(h, { company: "", photos: [] });
    expect(has(/Odcisk dokumentu/)).toBe(false);
  });
});
