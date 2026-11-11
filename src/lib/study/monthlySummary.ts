import { cell } from "@/lib/shifts/timesheet";

/**
 * B4.5: Zestawienie miesiąca — godziny, punkty, ryczałty, fuchy, wpłaty, koszt materiału.
 * Osobno „Dla szefa" i „Moje" (H3.6). Rozwinięcie linii „Z budów" w Grafiku.
 */

export interface MonthlySummaryLine {
  label: string;      // np. "Godziny", "Punkty", "Fuchy", "Materiał"
  quantity: number;   // liczba godzin, punktów, itd.
  rate: number;       // stawka (zł/h, zł/pkt, itd)
  total: number;      // razem (zł)
}

export interface MonthlySummary {
  year: number;
  month: number;      // 1-12
  lines: MonthlySummaryLine[];
  payments: Array<{ date: number; amount: number }>;  // wpłaty
  totalEarned: number;
  totalPaid: number;
  balance: number;    // zarobek - wpłaty
}

export interface MonthlyView {
  full: MonthlySummary;   // Dla szefa: wszystko
  mine: MonthlySummary;   // Moje: bez pewnych linii
}

export function createMonthlySummary(
  year: number,
  month: number,
  lines: MonthlySummaryLine[] = [],
  payments: Array<{ date: number; amount: number }> = []
): MonthlySummary {
  const totalEarned = lines.reduce((sum, line) => sum + line.total, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  return {
    year,
    month,
    lines,
    payments,
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    balance: Math.round((totalEarned - totalPaid) * 100) / 100,
  };
}

export function summaryForDisplay(summary: MonthlySummary, forShef = false): MonthlySummary {
  if (forShef) return summary;
  // "Moje": bez pewnych linii (decyzja H3.6)
  // Tymczasowo zwracamy wszystkie linie
  return summary;
}

export function exportMonthlySummaryCSV(view: MonthlyView): string {
  const { full, mine } = view;
  const header = "Lp.,Pozycja,Ilość,Stawka (zł),Razem (zł)\n";

  const fullLines = full.lines
    .map((line, idx) => `${idx + 1},${cell(line.label)},${line.quantity},${line.rate},${line.total.toFixed(2)}`)
    .join("\n");

  const paymentLines = full.payments
    .map((p, idx) => {
      const date = new Date(p.date).toLocaleDateString("pl-PL");
      return `${full.lines.length + idx + 1},${cell(`Wpłata (${date})`)},1,${p.amount},${p.amount.toFixed(2)}`;
    })
    .join("\n");

  const summary = [
    `\nRazem zarobek,,,${full.totalEarned.toFixed(2)}`,
    `Razem wpłacone,,,${full.totalPaid.toFixed(2)}`,
    `Saldo,,,${full.balance.toFixed(2)}`,
  ].join("\n");

  return header + fullLines + (paymentLines ? "\n" + paymentLines : "") + summary;
}
