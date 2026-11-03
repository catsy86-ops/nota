import { useEffect, useState } from "react";

type Preset = { label: string; at: Date };
type Mod = typeof import("@/lib/reminderShiftPresets");

let mod: Mod | null = null;
let pending: Promise<Mod> | null = null;

/**
 * Grafik poza paczką startową (Plan-nowy 1.5): moduł presetów „po zmianie” (z całym store Grafiku)
 * doczytuje się w tle po starcie albo przy pierwszym otwarciu pickera, potem jest od razu.
 */
export function loadShiftPresets(): Promise<Mod> {
  pending ??= import("@/lib/reminderShiftPresets").then((m) => (mod = m));
  return pending;
}

/** Terminy względem grafiku; pusta lista, dopóki moduł nie doszedł (zwykle ułamek sekundy, z precache). */
export function useShiftPresets(now: Date): Preset[] {
  const [, setLoaded] = useState(mod !== null);
  useEffect(() => {
    if (!mod) void loadShiftPresets().then(() => setLoaded(true));
  }, []);
  return mod ? mod.currentShiftPresets(now) : [];
}
