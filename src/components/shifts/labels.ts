import type { SettlementMonths, WorkSystem } from "@/lib/shifts";

export const PERIOD_LABELS: Record<SettlementMonths, string> = {
  1: "1 miesiąc", 2: "2 miesiące", 3: "3 miesiące (kwartał)", 4: "4 miesiące", 6: "6 miesięcy", 12: "12 miesięcy",
};

export const WORK_SYSTEM_LABELS: Record<WorkSystem, string> = {
  basic: "Podstawowy — 8 h na dobę",
  equivalent: "Równoważny — do 12 h wg grafiku",
};
