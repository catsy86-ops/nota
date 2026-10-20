import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Styl aplikacji („skórka”) — niezależny od jasny/ciemny. „Zeszyt” to domyślny
 * kierunek i jedyny, który słucha przełącznika jasny/ciemny; pozostałe mają
 * jeden, zaprojektowany schemat (`SKIN_SCHEME`). Tokeny i tła: `src/styles/skins.css`
 * pod `html[data-skin="…"]`.
 */
export type Skin = "zeszyt" | "plan" | "neon" | "zorza" | "miedz" | "matrix" | "hydraulika";

export const SKINS: readonly Skin[] = ["zeszyt", "plan", "neon", "zorza", "miedz", "matrix", "hydraulika"];

/** Schemat stylu: `null` = jasny lub ciemny według przełącznika (tylko Zeszyt). */
export const SKIN_SCHEME: Record<Skin, "light" | "dark" | null> = {
  zeszyt: null,
  plan: "dark",
  neon: "dark",
  zorza: "dark",
  miedz: "light",
  matrix: "dark",
  hydraulika: "dark",
};

/** Kolor paska stanu / okna PWA. Opisy i miniatury galerii: `skinGallery.ts` (tylko Ustawienia). */
export const SKIN_THEME_COLOR: Record<Skin, string> = {
  zeszyt: "#f0b429",
  plan: "#10304f",
  neon: "#130a1b",
  zorza: "#060a17",
  miedz: "#ae5a28",
  matrix: "#020a03",
  hydraulika: "#0b1e2b",
};

export function isSkin(v: unknown): v is Skin {
  return typeof v === "string" && (SKINS as readonly string[]).includes(v);
}

export const skinStore = createPersistedStore<Skin>("kaczy.skin.v1", "zeszyt", {
  merge: (defaults, stored) => (isSkin(stored) ? stored : defaults),
});

export const useSkin = () => skinStore.use();
export const setSkin = (s: Skin) => skinStore.set(s);
