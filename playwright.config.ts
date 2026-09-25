import { defineConfig, devices } from "@playwright/test";

// Runs against the real production build (`vite build` + `vite preview`), not
// the dev server: the service worker is disabled in dev (`devOptions.enabled:
// false` in vite.config.ts), so PWA-specific specs (e2e/pwa.spec.ts) need the
// actual generated sw.js to test against.
export default defineConfig({
  testDir: "./e2e",
  // A single `vite preview` instance backs every test; running many workers
  // against it locally was flaky (goto timeouts under concurrent load).
  workers: 1,
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
