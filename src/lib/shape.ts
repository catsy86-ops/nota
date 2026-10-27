import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Kształt interfejsu (plan motywów 1.2; Ustawienia → Wygląd → „Kształt”): mnożnik wszystkich
 * promieni — przyciski, pola, kafle, okna. Działa w każdym stylu, per urządzenie.
 * CSS: `html[data-shape]` w `src/styles/shape.css`, tokeny w `src/index.css` (`--shape`).
 */
export type Shape = "sharp" | "normal" | "soft";

const isShape = (v: unknown): v is Shape => v === "sharp" || v === "normal" || v === "soft";

function applyToDom(shape: Shape) {
  if (typeof document === "undefined") return;
  if (shape === "normal") delete document.documentElement.dataset.shape;
  else document.documentElement.dataset.shape = shape;
}

const store = createPersistedStore<Shape>("kaczy.shape.v1", "normal", {
  merge: (defaults, stored) => (isShape(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useShape = () => store.use();
export const setShape = (s: Shape) => store.set(s);
