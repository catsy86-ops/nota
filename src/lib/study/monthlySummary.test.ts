import { describe, it, expect } from "vitest";
import { createMonthlySummary, exportMonthlySummaryCSV } from "./monthlySummary";

describe("monthlySummary", () => {
  it("createMonthlySummary: sumuje zarobek i wpłaty osobno, bez salda", () => {
    const s = createMonthlySummary(
      "2026-11",
      [{ label: "Lipowa 5 — punkty", quantity: 4, total: 600 }, { label: "Moje zlecenia", quantity: 1, total: 350.5 }],
      [{ day: "2026-11-20", site: "Lipowa 5", amount: 500 }, { day: "2026-11-05", site: "Polna 2", amount: 250.25 }],
    );
    expect(s.totalEarned).toBe(950.5);
    expect(s.totalPaid).toBe(750.25);
    expect(s).not.toHaveProperty("balance");
    expect(s.payments.map((p) => p.day)).toEqual(["2026-11-05", "2026-11-20"]); // od najstarszej
  });

  it("createMonthlySummary: zaokrągla do 2 miejsc i radzi sobie z pustym miesiącem", () => {
    expect(createMonthlySummary("2026-11", [{ label: "x", quantity: 1, total: 0.1 + 0.2 }]).totalEarned).toBe(0.3);
    const empty = createMonthlySummary("2026-11");
    expect(empty).toMatchObject({ lines: [], payments: [], totalEarned: 0, totalPaid: 0 });
  });

  it("exportMonthlySummaryCSV: BOM, średniki, przecinek dziesiętny, CRLF i sumy", () => {
    const csv = exportMonthlySummaryCSV(createMonthlySummary(
      "2026-11",
      [{ label: "Lipowa 5 — punkty", quantity: 4, total: 600 }],
      [{ day: "2026-11-15", site: "Lipowa 5", amount: 2000 }],
    ));
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Rodzaj;Pozycja;Ilość;Kwota (zł)");
    expect(lines[1]).toBe("Zarobek;Lipowa 5 — punkty;4;600,00");
    expect(lines[2]).toBe("Wpłata;Lipowa 5 (2026-11-15);1;2000,00");
    expect(lines.at(-2)).toBe("Razem;Zarobek;;600,00");
    expect(lines.at(-1)).toBe("Razem;Wpłacone w miesiącu;;2000,00");
  });

  it("exportMonthlySummaryCSV: etykiety z formułą i średnikiem są zabezpieczone", () => {
    const csv = exportMonthlySummaryCSV(createMonthlySummary("2026-11", [{ label: "=HYPERLINK(1);x", quantity: 1, total: 1 }]));
    expect(csv).toContain('"\'=HYPERLINK(1);x"');
  });
});
