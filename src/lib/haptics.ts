import { isEffectEnabled } from "@/lib/effectsSettings";
import { isMotionReduced } from "@/hooks/useMotionPref";

export type HapticKind = "tap" | "success" | "warn";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  success: [10, 45, 16],
  warn: [28, 50, 28],
};

/**
 * Krótka wibracja na telefonie. Po cichu nic nie robi bez `navigator.vibrate`
 * (iOS, desktop), przy wskaźniku precyzyjnym (mysz), przy ograniczonym ruchu
 * i gdy wyłączono „Wibracje na telefonie”.
 */
export function haptic(kind: HapticKind): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (!isEffectEnabled("haptics")) return;
    if (isMotionReduced()) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* wibracja jest dodatkiem — nigdy nie psuje akcji */
  }
}
