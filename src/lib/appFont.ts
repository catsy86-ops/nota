import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Krój tekstu aplikacji (Ustawienia → Wygląd → „Krój tekstu”). `default` = krój stylu
 * (Zeszyt: Plus Jakarta Sans). Pozostałe zmieniają tekst i nagłówki Zeszytu; style
 * z własnym krojem nagłówków (Plan, Neon, Zorza, Miedź) zachowują nagłówki.
 * CSS: `html[data-font]` w `src/styles/fonts.css`.
 */
export type AppFont = "default" | "inter" | "nunito" | "atkinson" | "literata" | "manrope" | "lexend";

export const APP_FONTS: readonly AppFont[] = ["default", "inter", "nunito", "atkinson", "literata", "manrope", "lexend"];

export const APP_FONT_META: Record<AppFont, { label: string; blurb: string; family: string }> = {
  default: { label: "Domyślny", blurb: "Krój stylu — w Zeszycie Plus Jakarta Sans.", family: "'Plus Jakarta Sans Variable', sans-serif" },
  inter: { label: "Inter", blurb: "Neutralny, gęsty — dużo tekstu na ekranie.", family: "'Inter Variable', sans-serif" },
  nunito: { label: "Nunito", blurb: "Zaokrąglony i przyjazny.", family: "'Nunito Variable', sans-serif" },
  atkinson: { label: "Atkinson", blurb: "Najczytelniejszy: wyraźne I, l, 1 i 0, O.", family: "'Atkinson Hyperlegible Next Variable', sans-serif" },
  literata: { label: "Literata", blurb: "Szeryfowy, do długiego czytania.", family: "'Literata Variable', Georgia, serif" },
  manrope: { label: "Manrope", blurb: "Nowoczesny, geometryczny.", family: "'Manrope Variable', sans-serif" },
  lexend: { label: "Lexend", blurb: "Szeroki, spokojny w czytaniu.", family: "'Lexend Variable', sans-serif" },
};

export function isAppFont(v: unknown): v is AppFont {
  return typeof v === "string" && (APP_FONTS as readonly string[]).includes(v);
}

function applyToDom(font: AppFont) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (font === "default") delete root.dataset.font;
  else root.dataset.font = font;
}

const store = createPersistedStore<AppFont>("kaczy.font.v1", "default", {
  merge: (defaults, stored) => (isAppFont(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useAppFont = () => store.use();
export const setAppFont = (f: AppFont) => store.set(f);
