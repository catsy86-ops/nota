import { cell } from "@/lib/shifts/timesheet";

/**
 * B4.5 Zestawienie miesiąca: zarobek z budów (punkty, etapy, ryczałt, własne zlecenia) i wpłaty, które
 * wpłynęły w tym miesiącu — do CSV dla siebie lub księgowej. Liczby bierze z tych samych funkcji co
 * podsumowanie Grafiku (`monthSiteEarnings`), więc oba ekrany się zgadzają.
 *
 * Bez „salda miesiąca”: wpłata często dotyczy pracy z wcześniejszego miesiąca, więc różnica zarobku i wpłat
 * z jednego miesiąca byłaby myląca. Prawdziwe saldo jest per budowa (`billingStatement` → „Zostało do zapłaty”).
 */
export interface MonthlySummaryLine {
  label: string;      // np. „Lipowa 5 — punkty”
  quantity: number;   // liczba sztuk (punktów, etapów, zleceń); 1 dla ryczałtu
  total: number;      // razem (zł)
}

export interface MonthlyPayment {
  /** Dzień wpłaty „RRRR-MM-DD”. */
  day: string;
  /** Budowa, z której wpłata. */
  site: string;
  amount: number;
}

export interface MonthlySummary {
  /** „2026-10”. */
  monthKey: string;
  lines: MonthlySummaryLine[];
  payments: MonthlyPayment[];
  totalEarned: number;
  totalPaid: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const csvNum = (n: number) => n.toFixed(2).replace(".", ",");

export function createMonthlySummary(monthKey: string, lines: MonthlySummaryLine[] = [], payments: MonthlyPayment[] = []): MonthlySummary {
  return {
    monthKey,
    lines,
    payments: [...payments].sort((a, b) => a.day.localeCompare(b.day)),
    totalEarned: round2(lines.reduce((s, l) => s + l.total, 0)),
    totalPaid: round2(payments.reduce((s, p) => s + p.amount, 0)),
  };
}

/** CSV jak reszta eksportów: BOM, średnik, przecinek dziesiętny, CRLF; teksty przez `cell()` (chroni przed formułami). */
export function exportMonthlySummaryCSV(summary: MonthlySummary): string {
  const rows: string[][] = [["Rodzaj", "Pozycja", "Ilość", "Kwota (zł)"]];
  for (const l of summary.lines) rows.push(["Zarobek", l.label, String(l.quantity), csvNum(l.total)]);
  for (const p of summary.payments) rows.push(["Wpłata", `${p.site} (${p.day})`, "1", csvNum(p.amount)]);
  rows.push([]);
  rows.push(["Razem", "Zarobek", "", csvNum(summary.totalEarned)]);
  rows.push(["Razem", "Wpłacone w miesiącu", "", csvNum(summary.totalPaid)]);
  return "﻿" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
