import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Ramki kart i podziałów (Ustawienia → Wygląd → „Ramki”): jak mocno widać krawędź `--border`.
 * Wartość to procent koloru krawędzi zmieszany z przezroczystością (`color-mix`), więc działa
 * w każdym motywie bez osobnej palety. `odblask` ma własne, pełne ramki i tego nie czyta.
 * - `soft` — prawie niewidoczne (domyślne),
 * - `normal` — po poprzedniej zmianie motywów,
 * - `strong` — pełny kolor motywu, jak przed zmianą.
 * CSS: `--frame-mix` ustawiane inline na `<html>` tu; tokeny w `src/index.css` i `src/styles/skins/*.css`.
 */
export type Frames = "soft" | "normal" | "strong";

export const FRAME_MIX: Record<Frames, number> = { soft: 30, normal: 55, strong: 100 };

const isFrames = (v: unknown): v is Frames => v === "soft" || v === "normal" || v === "strong";

/** Czysta zamiana wyboru na procent do `color-mix`. */
export function frameMix(frames: Frames): string {
  return `${FRAME_MIX[frames]}%`;
}

function applyToDom(frames: Frames) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--frame-mix", frameMix(frames));
}

const store = createPersistedStore<Frames>("kaczy.frames.v1", "soft", {
  merge: (defaults, stored) => (isFrames(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useFrames = () => store.use();
export const setFrames = (f: Frames) => store.set(f);
