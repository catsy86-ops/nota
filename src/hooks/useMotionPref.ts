import { useCallback, useEffect, useSyncExternalStore } from "react";
import { applyToDom, isMotionReduced, motionStore, setMotionMode, type MotionMode } from "@/lib/motionPref";

export { isMotionReduced, setMotionMode, systemPrefersReduced, type MotionMode } from "@/lib/motionPref";

export function useMotionPref() {
  const currentMode = useSyncExternalStore(motionStore.subscribe, motionStore.get, () => "system" as MotionMode);
  const reduced = useSyncExternalStore(
    motionStore.subscribe,
    () => isMotionReduced(),
    () => false,
  );

  useEffect(() => { applyToDom(); }, [currentMode]);

  const setMode = useCallback((m: MotionMode) => setMotionMode(m), []);

  return { mode: currentMode, reduced, setMode };
}
