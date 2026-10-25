import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Zrzuty wyglądu (plan UI/UX 2026-10-25, Faza 0.1): tylko testy @visual, tylko komputer
// (telefon idzie przez `isMobile` w samym pliku). Uruchomienie: `npm run test:visual`.
// Nowe bazowe zrzuty: `npm run test:visual -- --update-snapshots` (po przeglądzie różnic).
export default defineConfig({
  ...base,
  grepInvert: undefined,
  grep: /@visual/,
  projects: (base.projects ?? []).filter((p) => p.name === "chromium"),
});
