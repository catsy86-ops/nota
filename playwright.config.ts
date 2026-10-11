import { defineConfig, devices } from "@playwright/test";

// Runs against the real production build (`vite build` + `vite preview`), not
// the dev server: the service worker is disabled in dev (`devOptions.enabled:
// false` in vite.config.ts), so PWA-specific specs (e2e/pwa.spec.ts) need the
// actual generated sw.js to test against.
export default defineConfig({
  testDir: "./e2e",
  // Jedna instancja `vite preview` obsługuje wszystkie testy; wiele workerów lokalnie
  // bywało niestabilne (timeouty goto). Domyślnie 1; `PW_WORKERS=3 npm run test:e2e` przyspiesza przebieg.
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1,
  // Przerywa, gdy dist/ jest starszy niż źródła (reuseExistingServer pomija build).
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
