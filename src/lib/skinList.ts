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

/**
 * Ikona karty (favicon) w barwach stylu (plan motywów 2.6): tło i litera monogramu „N”.
 * Zeszyt zostaje przy `public/favicon.png` (znak marki); ikona PWA na ekranie głównym jest jedna.
 */
export const SKIN_ICON: Record<Exclude<Skin, "zeszyt">, { bg: string; fg: string }> = {
  plan: { bg: "#10304f", fg: "#6cd3fb" },
  neon: { bg: "#130a1b", fg: "#ff47d1" },
  zorza: { bg: "#060a17", fg: "#3cf5a6" },
  miedz: { bg: "#ae5a28", fg: "#fcfbf9" },
  matrix: { bg: "#020a03", fg: "#00ff41" },
  hydraulika: { bg: "#0b1e2b", fg: "#d08a4e" },
};
