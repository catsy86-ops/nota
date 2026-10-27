/**
 * Lista stylów i ich schematy — jedyne źródło dla aplikacji (`skins.ts` reeksportuje) i testów
 * (`e2e/a11y.spec.ts`, `e2e/visual.spec.ts`, `skinContrast.test.ts`, `skinContract.test.ts`).
 * Bez importów, żeby Playwright mógł ją wczytać bez aliasu `@/` (plan motywów 0.3).
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
