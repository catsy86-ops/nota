import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Rozmiar tekstu całej aplikacji (Ustawienia → Wygląd → „Rozmiar tekstu”, polecenia w palecie).
 *
 * Wszystko w aplikacji jest w `rem`, więc skala idzie przez korzeń `html`: tekst, przyciski
 * i odstępy rosną razem, a układ się przelicza. Zmienna `--text-scale` mnoży rozmiar bazowy
 * (`text-size.css`) i tryb budowy (`site.css`), więc oba się składają, zamiast nadpisywać.
 *
 * Przechowujemy indeks kroku (0–4), nie procent — zmiana skali w przyszłości nie zmienia zapisu.
 */

export const TEXT_SIZE_STEPS = [90, 100, 112.5, 125, 140] as const;
export const DEFAULT_TEXT_SIZE_STEP = 1;
const LAST = TEXT_SIZE_STEPS.length - 1;

export const TEXT_SIZE_LABELS = ["Mniejszy", "Domyślny", "Większy", "Duży", "Bardzo duży"] as const;

/** Indeks kroku z zapisu; cokolwiek innego (liczba spoza zakresu, tekst, `null`) wraca do domyślnego. */
export function cleanTextSizeStep(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= LAST ? v : DEFAULT_TEXT_SIZE_STEP;
}

/** Krok po zmianie o `delta`, przycięty do zakresu (bez zawijania). */
export function nextTextSizeStep(step: number, delta: number): number {
  return Math.min(LAST, Math.max(0, step + delta));
}

/** Skala jako mnożnik (1 = 100 %) dla zmiennej CSS. */
export function textScale(step: number): number {
  return TEXT_SIZE_STEPS[cleanTextSizeStep(step)] / 100;
}

function applyToDom(step: number) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const clean = cleanTextSizeStep(step);
  root.style.setProperty("--text-scale", String(textScale(clean)));
  root.dataset.textSize = String(clean);
}

const store = createPersistedStore<number>("kaczy.textSize.v1", DEFAULT_TEXT_SIZE_STEP, {
  merge: (defaults, stored) => (typeof stored === "number" ? cleanTextSizeStep(stored) : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useTextSizeStep = () => store.use();
export const getTextSizeStep = () => store.get();
export const setTextSizeStep = (step: number) => store.set(cleanTextSizeStep(step));
export const changeTextSize = (delta: number) => store.set(nextTextSizeStep(store.get(), delta));
export const resetTextSize = () => store.set(DEFAULT_TEXT_SIZE_STEP);
