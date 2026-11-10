import { describe, it, expect } from "vitest";
import { createMonthlySummary, exportMonthlySummaryCSV } from "./monthlySummary";

describe("monthlySummary", () => {
  it("createMonthlySummary: oblicza zarobek z linii", () => {
    const summary = createMonthlySummary(2026, 11, [
      { label: "Godziny", quantity: 100, rate: 50, total: 5000 },
      { label: "Punkty", quantity: 200, rate: 10, total: 2000 },
    ]);

    expect(summary.totalEarned).toBe(7000);
    expect(summary.totalPaid).toBe(0);
    expect(summary.balance).toBe(7000);
  });

  it("createMonthlySummary: oblicza saldo z wpłatami", () => {
    const summary = createMonthlySummary(
      2026,
      11,
      [{ label: "Godziny", quantity: 100, rate: 50, total: 5000 }],
      [
        { date: Date.now(), amount: 2000 },
        { date: Date.now(), amount: 1500 },
      ]
    );

    expect(summary.totalEarned).toBe(5000);
    expect(summary.totalPaid).toBe(3500);
    expect(summary.balance).toBe(1500);
  });

  it("createMonthlySummary: zaokrągla do 2 miejsc po przecinku", () => {
    const summary = createMonthlySummary(2026, 11, [
      { label: "Test", quantity: 1, rate: 33.33, total: 33.33 },
    ]);

    expect(summary.totalEarned).toBe(33.33);
  });

  it("createMonthlySummary: zwraca pustą listę dla braku linii", () => {
    const summary = createMonthlySummary(2026, 11);
    expect(summary.lines).toEqual([]);
    expect(summary.totalEarned).toBe(0);
  });

  it("exportMonthlySummaryCSV: eksportuje CSV z nagłówkiem i rzetami", () => {
    const view = {
      full: createMonthlySummary(2026, 11, [
        { label: "Godziny", quantity: 100, rate: 50, total: 5000 },
      ]),
      mine: createMonthlySummary(2026, 11, [
        { label: "Godziny", quantity: 100, rate: 50, total: 5000 },
      ]),
    };

    const csv = exportMonthlySummaryCSV(view);

    expect(csv).toContain("Lp.,Pozycja,Ilość,Stawka (zł),Razem (zł)");
    expect(csv).toContain("1,Godziny,100,50,5000.00");
    expect(csv).toContain("Razem zarobek,,,5000.00");
    expect(csv).toContain("Saldo,,,5000.00");
  });

  it("exportMonthlySummaryCSV: dołącza wpłaty do CSV", () => {
    const view = {
      full: createMonthlySummary(
        2026,
        11,
        [{ label: "Godziny", quantity: 100, rate: 50, total: 5000 }],
        [{ date: new Date("2026-11-15").getTime(), amount: 2000 }]
      ),
      mine: createMonthlySummary(
        2026,
        11,
        [{ label: "Godziny", quantity: 100, rate: 50, total: 5000 }]
      ),
    };

    const csv = exportMonthlySummaryCSV(view);

    expect(csv).toContain("Wpłata");
    expect(csv).toContain("2000");
    expect(csv).toContain("Saldo,,,3000.00");
  });
});
