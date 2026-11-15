import { createPersistedStore } from "@/lib/persistedStore";

export type MotionMode = "system" | "reduced" | "full";

function isValidMode(v: unknown): v is MotionMode {
  return v === "system" || v === "reduced" || v === "full";
}

export function systemPrefersReduced(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isMotionReduced(): boolean {
  const mode = motionStore.get();
  return mode === "reduced" || (mode === "system" && systemPrefersReduced());
}

/** Applies `data-motion="reduced" | "full"` on <html> so CSS can react. */
export function applyToDom() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-motion", isMotionReduced() ? "reduced" : "full");
}

export const motionStore = createPersistedStore<MotionMode>("kaczy.motion.v1", "system", {
  merge: (defaults, stored) => (isValidMode(stored) ? stored : defaults),
  onChange: applyToDom,
});

export function setMotionMode(next: MotionMode) {
  motionStore.set(next);
}

applyToDom();

/** Keep the DOM attribute in sync with OS-level changes. */
if (typeof window !== "undefined") {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener?.("change", () => { applyToDom(); motionStore.notify(); });
}
