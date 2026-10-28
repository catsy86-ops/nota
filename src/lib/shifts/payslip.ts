/**
 * Porównanie szacunku brutto z paskiem wypłaty (G4.4, B5). Szacunek liczy `summary.ts`,
 * pasek wpisuje użytkownik. Tu tylko różnica i podpowiedzi, czego zwykle brakuje.
 */

export interface PayslipFacts {
  /** Minuty nocne w miesiącu (dodatek nocny). */
  nightMinutes: number;
  /** Dni urlopu i L4 w miesiącu. */
  absenceDays: number;
}

export interface PayslipComparison {
  estimate: number;
  paid: number;
  /** Wypłata minus szacunek, w zł (dodatnia = wypłacono więcej). */
  diff: number;
  /** Różnica w procentach od szacunku (0, gdy szacunek 0). */
  percent: number;
  hints: string[];
}

/** Różnica poniżej tego progu (zł) uznajemy za zgodną — zaokrąglenia w pasku. */
export const PAYSLIP_TOLERANCE = 1;

/** `null`, gdy nic nie wpisano (wypłata ≤ 0): nie ma z czym porównywać. */
export function comparePayslip(estimate: number, paid: number, facts: PayslipFacts): PayslipComparison | null {
  if (!(paid > 0)) return null;
  const diff = Math.round((paid - estimate) * 100) / 100;
  const percent = estimate > 0 ? Math.round((diff / estimate) * 1000) / 10 : 0;
  const hints: string[] = [];
  if (diff < -PAYSLIP_TOLERANCE) {
    if (facts.nightMinutes > 0) hints.push("W miesiącu są godziny nocne: sprawdź, czy dodatek nocny jest w pasku.");
    if (facts.absenceDays > 0) hints.push("Są dni urlopu lub L4: sprawdź, czy wypłata je uwzględnia.");
    hints.push("Sprawdź, czy wszystkie premie są wpisane w Grafiku.");
  } else if (diff > PAYSLIP_TOLERANCE) {
    hints.push("Wypłata wyższa niż szacunek: może to być premia albo wyrównanie, których nie ma w Grafiku.");
  }
  return { estimate, paid, diff, percent, hints };
}
