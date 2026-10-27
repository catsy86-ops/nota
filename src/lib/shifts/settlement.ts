import type { SettlementMonths } from "./model";

/**
 * Okres rozliczeniowy, w który wpada miesiąc (`month` od 0). Okresy idą po
 * sobie od miesiąca `start` — kwartał od lutego to luty–kwiecień, maj–lipiec,
 * sierpień–październik, listopad–styczeń; ostatni zaczyna się rok wcześniej.
 */
export function settlementPeriod(year: number, month: number, months: SettlementMonths, start = 0): { year: number; startMonth: number; months: SettlementMonths } {
  const abs = year * 12 + month;
  const first = abs - ((((month - start) % months) + months) % months);
  return { year: Math.floor(first / 12), startMonth: first % 12, months };
}
