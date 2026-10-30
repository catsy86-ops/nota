import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Gęstość całego interfejsu (plan motywów 4.2): mnożnik odstępów, wysokości i szerokości. Tailwind v4 liczy
 * każdy odstęp jako `calc(var(--spacing) * n)`, więc jedna zmienna na `<html>` przeskalowuje wszystko.
 * Działa tylko przy myszy i klawiaturze (`pointer: fine`) — na dotyku cele zostają co najmniej 44 px.
 * CSS: `html[data-ui-density]` w `src/index.css`. Per urządzenie.
 */
export type UiDensity = "compact" | "normal" | "comfy";

const isDensity = (v: unknown): v is UiDensity => v === "compact" || v === "normal" || v === "comfy";

function applyToDom(d: UiDensity) {
  if (typeof document === "undefined") return;
  if (d === "normal") delete document.documentElement.dataset.uiDensity;
  else document.documentElement.dataset.uiDensity = d;
}

const store = createPersistedStore<UiDensity>("kaczy.uiDensity.v1", "normal", {
  merge: (defaults, stored) => (isDensity(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useUiDensity = () => store.use();
export const setUiDensity = (d: UiDensity) => store.set(d);
