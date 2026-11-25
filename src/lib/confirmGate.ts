import type { ConfirmKey } from "@/lib/confirmPrefs";

/**
 * Bramka potwierdzeń bez interfejsu (plan architektury A1.5): okno renderuje `ConfirmActionDialog`,
 * a hooki znają tylko ten kontrakt.
 */
export interface ConfirmRequest {
  kind: ConfirmKey;
  title: string;
  description: string;
  run: () => void;
}

export type ConfirmFn = (action: ConfirmRequest) => void;

let skipConfirm = false;

/** Czy trwa wywołanie z `runWithoutConfirm` (okno ma się nie pokazać). */
export const confirmSkipped = (): boolean => skipConfirm;

/**
 * Wykonuje akcję bez okna potwierdzenia — dla gestów (swipe kafla), które są odwracalne
 * przez „Cofnij” i same w sobie są świadomą decyzją. Działa tylko dla wywołania synchronicznego.
 */
export function runWithoutConfirm(fn: () => void) {
  skipConfirm = true;
  try { fn(); } finally { skipConfirm = false; }
}
