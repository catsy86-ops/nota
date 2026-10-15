import { createPersistedStore } from "@/lib/persistedStore";

/**
 * „Tryb budowa” — do pracy w rękawicach i w słońcu: większy tekst i cele dotyku,
 * mocniejszy kontrast, bez dekoracji tła, dłuższe „Cofnij”. Działa nad każdym stylem.
 * `auto` włącza go, gdy system prosi o większy kontrast (`prefers-contrast: more`).
 * CSS: `html[data-site]` w `src/styles/site.css`.
 */
export type SiteMode = "off" | "on" | "auto";

const isSiteMode = (v: unknown): v is SiteMode => v === "off" || v === "on" || v === "auto";

const mql = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-contrast: more)") : null;

/** Czysta decyzja: czy tryb jest teraz aktywny. */
export function resolveSiteMode(mode: SiteMode, systemMoreContrast: boolean): boolean {
  return mode === "on" || (mode === "auto" && systemMoreContrast);
}

const store = createPersistedStore<SiteMode>("kaczy.siteMode.v1", "off", {
  merge: (defaults, stored) => (isSiteMode(stored) ? stored : defaults),
  onChange: () => applyToDom(),
});

export function isSiteModeActive(): boolean {
  return resolveSiteMode(store.get(), !!mql?.matches);
}

function applyToDom() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (isSiteModeActive()) root.dataset.site = "";
  else delete root.dataset.site;
}

applyToDom();
mql?.addEventListener?.("change", () => { applyToDom(); store.notify(); });

export const useSiteMode = () => store.use();
export const setSiteMode = (m: SiteMode) => store.set(m);

/** Czas dymka z „Cofnij”: w trybie budowa dłużej — palec w rękawicy trafia wolniej. */
export function undoToastDuration(base = 5000): number {
  return isSiteModeActive() ? Math.max(base, 8000) : base;
}
