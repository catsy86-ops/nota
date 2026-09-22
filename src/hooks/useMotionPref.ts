import { useCallback, useEffect, useSyncExternalStore } from "react";

export type MotionMode = "system" | "reduced" | "full";

const KEY = "kaczy.motion.v1";

function read(): MotionMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "system" || raw === "reduced" || raw === "full") return raw;
  } catch { /* ignore */ }
  return "system";
}

let mode: MotionMode = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function systemPrefersReduced(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isMotionReduced(): boolean {
  return mode === "reduced" || (mode === "system" && systemPrefersReduced());
}

/** Applies `data-motion="reduced" | "full"` on <html> so CSS can react. */
function applyToDom() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-motion", isMotionReduced() ? "reduced" : "full");
}

export function setMotionMode(next: MotionMode) {
  mode = next;
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  applyToDom();
  emit();
}

applyToDom();

/** Keep the DOM attribute in sync with OS-level changes. */
if (typeof window !== "undefined") {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener?.("change", () => { applyToDom(); emit(); });
}

export function useMotionPref() {
  const currentMode = useSyncExternalStore(subscribe, () => mode, () => mode);
  const reduced = useSyncExternalStore(
    subscribe,
    () => isMotionReduced(),
    () => false,
  );

  useEffect(() => { applyToDom(); }, [currentMode]);

  const setMode = useCallback((m: MotionMode) => setMotionMode(m), []);

  return { mode: currentMode, reduced, setMode };
}
