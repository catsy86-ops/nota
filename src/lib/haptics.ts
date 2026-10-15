import { isEffectEnabled } from "@/lib/effectsSettings";

/** tap — zwykła akcja, success — coś się udało, warn — utrata/błąd, selection — wybór lub chwyt. */
export type HapticKind = "tap" | "success" | "warn" | "selection";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 45, 16],
  warn: [28, 50, 28],
  selection: 4,
};

/**
 * Krótka wibracja na telefonie. Po cichu nic nie robi bez `navigator.vibrate`
 * (iOS, desktop), przy wskaźniku precyzyjnym (mysz) i gdy wyłączono „Wibracje
 * na telefonie”. Ograniczony ruch jej nie wyłącza — wibracja to nie animacja,
 * a w rękawicach bywa jedynym potwierdzeniem; ma własny przełącznik.
 */
export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (!isEffectEnabled("haptics")) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* wibracja jest dodatkiem — nigdy nie psuje akcji */
  }
}
