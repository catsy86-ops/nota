import { beforeEach, describe, expect, it, vi } from "vitest";

// Atrapa jsPDF (jak w invoicePdf.test.ts), rozszerzona o linie tabeli: zapisuje teksty, obrazy i liczbę linii.
const rec = vi.hoisted(() => ({ texts: [] as string[], images: 0, pages: 1, lines: 0, aligned: [] as string[] }));
vi.mock("jspdf", () => ({
  default: class FakeJsPdf {
    addFont() {}
    setFont() {}
    setFontSize() {}
    setDrawColor() {}
    setLineWidth() {}
    line() { rec.lines += 1; }
    getTextWidth() { return 10; }
    splitTextToSize(t: string) { return [t]; }
    text(t: string, _x: number, _y: number, o?: { align?: string }) { rec.texts.push(String(t)); if (o?.align) rec.aligned.push(String(t)); }
    addPage() { rec.pages += 1; }
    getNumberOfPages() { return rec.pages; }
    setPage() {}
    getImageProperties() { return { width: 100, height: 100 }; }
    addImage() { rec.images += 1; }
    output() { return new Blob(["%PDF-fake"], { type: "application/pdf" }); }
  },
}));

import { buildJobDonePdf, buildJobPdf, depositRows, jobPdfName, summaryParts } from "./jobPdf";
import type { Job } from "./jobs";

beforeEach(() => { rec.texts = []; rec.images = 0; rec.pages = 1; rec.lines = 0; rec.aligned = []; });

const labor = { id: "a", kind: "labor" as const, name: "Montaż baterii", qty: 2, unit: "usł.", price: 100, order: 0 };
const material = { id: "b", kind: "material" as const, name: "Bateria", qty: 1, unit: "szt.", price: 100, order: 1 };
const job = (over: Partial<Job> = {}): Job => ({ status: "quote", statusAt: 1, created: 1, items: [labor, material], ...over });
const card = { name: "Lipowa 5", address: "ul. Lipowa 5, Kraków", investor: "Jan Kowalski", phone: "600 100 200" };
const opts = { company: "Instalacje Test", today: "2026-11-13" };
const has = (text: string | RegExp) => rec.texts.some((t) => (typeof text === "string" ? t === text : text.test(t)));

describe("wycena w PDF (3.4)", () => {
  it("nazwa pliku, numer, daty, klient i tabela pozycji z kolumnami", async () => {
    const blob = await buildJobPdf(job({ margin: 20, doc: { number: "W/A/2026/001", issued: "2026-11-13" } }), card, opts);
    expect(blob.type).toBe("application/pdf");
    expect(jobPdfName("Lipowa 5")).toBe("Wycena - Lipowa 5.pdf");
    expect(has("Nr W/A/2026/001")).toBe(true);
    // Ważność domyślnie 14 dni od wystawienia, bez zapisu w dokumencie.
    expect(has("Data wystawienia: 13.11.2026   ·   Ważna do: 27.11.2026")).toBe(true);
    expect(has("Jan Kowalski")).toBe(true);
    expect(has("Tel. 600 100 200")).toBe(true);
    for (const header of ["Lp.", "Nazwa", "Ilość", "J.m.", "Cena", "Wartość"]) expect(has(header)).toBe(true);
    // Oba rodzaje pozycji: rodzaj w nawiasie, materiał z marżą (100 × 1,2 = 120), robocizna bez.
    expect(has("Montaż baterii (robocizna)")).toBe(true);
    expect(has("Bateria (materiał)")).toBe(true);
    expect(has("120 zł")).toBe(true);
    expect(has("200 zł")).toBe(true);
    expect(rec.lines).toBeGreaterThanOrEqual(3);
    expect(has("Razem")).toBe(true);
    expect(has("320 zł")).toBe(true);
  });

  it("jeden rodzaj pozycji: nazwa bez nawiasu; bez numeru i klienta nie ma tych linii", async () => {
    await buildJobPdf(job({ items: [labor] }), { ...card, investor: "", phone: undefined }, opts);
    expect(has("Montaż baterii")).toBe(true);
    expect(rec.texts.some((t) => t.startsWith("Nr "))).toBe(false);
    expect(has("Dla")).toBe(false);
  });

  it("rabat i VAT: wiersze podsumowania, nagłówki z „netto” i kwota brutto do zapłaty", async () => {
    const j = job({ items: [labor, { ...material, price: 300 }], doc: { discount: 10, vatMode: "net", vatRate: 23, notes: "Termin: 5 dni.\nZaliczka 30%." } });
    // 200 + 300 = 500, rabat 50 → netto 450, VAT 103,50, brutto 553,50.
    await buildJobPdf(j, card, opts);
    expect(has("Cena netto")).toBe(true);
    expect(has("Wartość netto")).toBe(true);
    expect(has("Suma pozycji (netto)")).toBe(true);
    expect(has("Rabat 10%")).toBe(true);
    expect(has("−50 zł")).toBe(true);
    expect(has("Razem netto")).toBe(true);
    expect(has("VAT 23%")).toBe(true);
    expect(has("103,50 zł")).toBe(true);
    expect(has("Razem brutto do zapłaty")).toBe(true);
    expect(has("553,50 zł")).toBe(true);
    // Uwagi: każda linia osobno.
    expect(has("Uwagi i warunki")).toBe(true);
    expect(has("Termin: 5 dni.")).toBe(true);
    expect(has("Zaliczka 30%.")).toBe(true);
  });

  it("summaryParts dla cen brutto: „w tym netto” i „w tym VAT”, a bez dokumentu sam wiersz „Razem”", () => {
    const labels = (j: ReturnType<typeof job>) => { const { detail, total } = summaryParts(j); return [...detail, total].map((r) => r.label); };
    const rows = labels(job({ doc: { vatMode: "gross", vatRate: 8 } }));
    expect(rows).toEqual(["w tym netto", "w tym VAT 8%", "Razem brutto do zapłaty"]);
    expect(labels(job())).toEqual(["Razem"]);
  });

  it("podpis klienta: ważny trafia pod wycenę jako obraz, sprzed zmiany treści zostawia puste pole", async () => {
    const sig = { name: "Jan Kowalski", at: new Date(2026, 10, 12).getTime(), image: "img" } as never;
    await buildJobPdf(job({ created: 1, changedAt: 5 }), { ...card, signature: sig }, { ...opts, signatureDataUrl: "data:image/png;base64,AAAA" });
    expect(rec.images).toBe(1);
    expect(has(/^Podpisał: Jan Kowalski, 12\.11\.2026$/)).toBe(true);

    rec.images = 0;
    rec.texts = [];
    await buildJobPdf(job({ created: 1, changedAt: new Date(2026, 10, 13).getTime() }), { ...card, signature: sig }, { ...opts, signatureDataUrl: "data:image/png;base64,AAAA" });
    expect(rec.images).toBe(0);
    expect(has("Data: ____________________")).toBe(true);
  });

  it("długa tabela przechodzi na kolejną stronę z powtórzonym nagłówkiem", async () => {
    const items = Array.from({ length: 60 }, (_, n) => ({ ...labor, id: `i${n}`, name: `Pozycja ${n + 1}`, order: n }));
    await buildJobPdf(job({ items }), card, opts);
    expect(rec.pages).toBeGreaterThan(1);
    expect(rec.texts.filter((t) => t === "Lp.").length).toBe(rec.pages);
  });
});

describe("potwierdzenie wykonania (3.2)", () => {
  it("pokazuje rabat i VAT z wyceny, a kwota do zapłaty zgadza się z wyceną", async () => {
    const j = job({ status: "done", items: [labor], doc: { number: "W/A/2026/002", discount: 50 } });
    await buildJobDonePdf(j, card, opts);
    expect(has("Dotyczy wyceny W/A/2026/002")).toBe(true);
    expect(has("Rabat 50%")).toBe(true);
    expect(has("Do zapłaty: 100 zł")).toBe(true);
  });
});

describe("zaliczka w PDF (5.3)", () => {
  it("wycena: wiersze zaliczki i kwota pozostała po niej", async () => {
    const j = job({ items: [labor], doc: { deposit: 60 } });
    expect(depositRows(j)).toEqual([{ label: "Zaliczka przed rozpoczęciem prac", value: "60 zł" }, { label: "Pozostało po zaliczce", value: "140 zł" }]);
    expect(depositRows(job({ items: [labor] }))).toEqual([]);
    await buildJobPdf(j, card, opts);
    expect(has("Zaliczka przed rozpoczęciem prac")).toBe(true);
    expect(has("Pozostało po zaliczce")).toBe(true);
    expect(has("140 zł")).toBe(true);
  });

  it("zaliczka większa od kwoty jest przycinana do kwoty, a pozostało nie jest ujemne", () => {
    expect(depositRows(job({ items: [labor], doc: { deposit: 900 } }))).toEqual([{ label: "Zaliczka przed rozpoczęciem prac", value: "200 zł" }, { label: "Pozostało po zaliczce", value: "0 zł" }]);
  });

  it("potwierdzenie wykonania: wpłacona zaliczka pomniejsza „do zapłaty”, zapłacone pokazuje całość", async () => {
    await buildJobDonePdf(job({ status: "done", items: [labor], doc: { depositPaid: 50 } }), card, opts);
    expect(has("Wpłacono (zaliczka)")).toBe(true);
    expect(has("−50 zł")).toBe(true);
    expect(has("Do zapłaty: 150 zł")).toBe(true);
    rec.texts = [];
    await buildJobDonePdf(job({ status: "paid", items: [labor], doc: { depositPaid: 50 } }), card, opts);
    expect(has("Zapłacono: 200 zł")).toBe(true);
    expect(has("Wpłacono (zaliczka)")).toBe(false);
  });
});
