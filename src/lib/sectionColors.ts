import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Podkreślenia działów (plan motywów 3.4): „subtelne” — cienka kreska w kolorze działu, stonowana;
 * „wyraźne” — grubsza i pełna. Kolory działów z `--sec-*` (index.css), per urządzenie.
 * CSS: `html[data-sections]` w `src/index.css`.
 */
export type SectionColors = "subtle" | "bold";

const isMode = (v: unknown): v is SectionColors => v === "subtle" || v === "bold";

function applyToDom(mode: SectionColors) {
  if (typeof document === "undefined") return;
  if (mode === "subtle") delete document.documentElement.dataset.sections;
  else document.documentElement.dataset.sections = mode;
}

const store = createPersistedStore<SectionColors>("kaczy.sectionColors.v1", "subtle", {
  merge: (defaults, stored) => (isMode(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useSectionColors = () => store.use();
export const setSectionColors = (mode: SectionColors) => store.set(mode);
