import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Wygląd ramek (Ustawienia → Wygląd → „Ramki”): kolor krawędzi i kolor tła kart.
 * Siłę krawędzi dalej ustawia `frames.ts` (`--frame-mix`). Tu tylko barwa.
 *
 * Nadpisanie idzie inline na `<html>`, więc działa we wszystkich skórkach bez edycji ich plików.
 * Tło jest zależne od jasności motywu: każda rodzina ma wariant jasny i ciemny, a wybór zmienia się
 * razem z motywem. Każde tło sprawdzane jest kontrastem z tekstem karty (`frameLook.test.ts`).
 */

export type FrameColorId = "theme" | "graphite" | "copper" | "blue" | "green" | "violet" | "rose";
export type FrameSurfaceId = "theme" | "warm" | "mint" | "sky" | "lavender" | "rose";

export interface FrameLook {
  color: FrameColorId;
  surface: FrameSurfaceId;
}

/** Kolor krawędzi (sRGB), mieszany z przezroczystością przez `--frame-mix`. */
export const FRAME_COLORS: Record<FrameColorId, { label: string; hex: string | null }> = {
  theme: { label: "Motyw", hex: null },
  graphite: { label: "Grafit", hex: "#6b7280" },
  copper: { label: "Miedź", hex: "#b45309" },
  blue: { label: "Błękit", hex: "#2563eb" },
  green: { label: "Zieleń", hex: "#15803d" },
  violet: { label: "Fiolet", hex: "#7c3aed" },
  rose: { label: "Róż", hex: "#db2777" },
};

/** Tło kart, osobno dla jasnego i ciemnego motywu (oklch). */
export const FRAME_SURFACES: Record<FrameSurfaceId, { label: string; light: string | null; dark: string | null }> = {
  theme: { label: "Motyw", light: null, dark: null },
  warm: { label: "Ciepłe", light: "oklch(0.9850 0.0120 85)", dark: "oklch(0.2500 0.0300 70)" },
  mint: { label: "Miętowe", light: "oklch(0.9750 0.0220 165)", dark: "oklch(0.2600 0.0400 165)" },
  sky: { label: "Błękitne", light: "oklch(0.9750 0.0180 245)", dark: "oklch(0.2600 0.0400 250)" },
  lavender: { label: "Lawendowe", light: "oklch(0.9750 0.0200 300)", dark: "oklch(0.2600 0.0450 300)" },
  rose: { label: "Różowe", light: "oklch(0.9750 0.0200 15)", dark: "oklch(0.2700 0.0400 15)" },
};

export const DEFAULT_FRAME_LOOK: FrameLook = { color: "theme", surface: "theme" };

const isColor = (v: unknown): v is FrameColorId => typeof v === "string" && v in FRAME_COLORS;
const isSurface = (v: unknown): v is FrameSurfaceId => typeof v === "string" && v in FRAME_SURFACES;

/** Krawędź: `color-mix` z `--frame-mix`, żeby siła z ustawienia „Ramki” dalej działała. */
export function borderValue(color: FrameColorId): string | null {
  const hex = FRAME_COLORS[color].hex;
  return hex ? `color-mix(in oklab, ${hex} var(--frame-mix), transparent)` : null;
}

/** Tło karty dla danego motywu (`isDark`); `null` = zostaje tło motywu. */
export function surfaceValue(surface: FrameSurfaceId, isDark: boolean): string | null {
  const s = FRAME_SURFACES[surface];
  return isDark ? s.dark : s.light;
}

function applyToDom(look: FrameLook) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  const isDark = document.documentElement.classList.contains("dark");
  const border = borderValue(look.color);
  if (border) style.setProperty("--border", border);
  else style.removeProperty("--border");
  const surface = surfaceValue(look.surface, isDark);
  if (surface) style.setProperty("--card", surface);
  else style.removeProperty("--card");
}

const store = createPersistedStore<FrameLook>("kaczy.frames.look.v1", DEFAULT_FRAME_LOOK, {
  merge: (defaults, stored) => ({
    color: isColor(stored?.color) ? stored.color : defaults.color,
    surface: isSurface(stored?.surface) ? stored.surface : defaults.surface,
  }),
  onChange: applyToDom,
});

applyToDom(store.get());

// Przełącznik jasny/ciemny zmienia klasę na <html>; tło ramek ma wtedy przejść na swój wariant.
if (typeof document !== "undefined") {
  new MutationObserver(() => applyToDom(store.get())).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

export const useFrameLook = () => store.use();
export const setFrameColor = (color: FrameColorId) => store.set({ ...store.get(), color });
export const setFrameSurface = (surface: FrameSurfaceId) => store.set({ ...store.get(), surface });
