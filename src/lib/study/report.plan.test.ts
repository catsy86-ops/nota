import { describe, it, expect } from "vitest";
import { buildJournalReport, reportBody, type ReportOptions } from "./report";
import type { PlanItem } from "./planItems";

// Plan na dziś (P-5): pozycje odhaczone danego dnia trafiają do raportu jako „Zrobione”.
const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h, 0).getTime();
const plan: PlanItem[] = [
  { id: "p1", text: "Montaż zaworu", at: at(2026, 10, 20), doneAt: at(2026, 10, 21, 15) },
  { id: "p2", text: "Próba szczelności", at: at(2026, 10, 20) },
  { id: "p3", text: "Zamówić mufy", at: at(2026, 10, 19), doneAt: at(2026, 10, 30, 8) },
];
const sites = { s1: { name: "Lipowa 5", hours: [], stages: [], plan } } as unknown as ReportOptions["sites"];
const base: ReportOptions = { siteId: null, sites, from: "2026-10-20", to: "2026-10-22", today: "2026-10-22" };

describe("raport dnia: zrobione z planu (P-5)", () => {
  it("odhaczenie tego dnia trafia do dnia raportu, także gdy nie ma wpisów", () => {
    const r = buildJournalReport([], base);
    const day = r.days.find((d) => d.key === "2026-10-21");
    expect(day?.done).toEqual(["Montaż zaworu"]);
    expect(reportBody(r)).toContain("Zrobione: Montaż zaworu");
  });

  it("pozycja nieodhaczona i odhaczona poza zakresem nie wchodzi do raportu", () => {
    const r = buildJournalReport([], base);
    expect(r.days.flatMap((d) => d.done)).toEqual(["Montaż zaworu"]);
    expect(reportBody(r)).not.toContain("Zamówić mufy");
    expect(reportBody(r)).not.toContain("Próba szczelności");
  });
});
