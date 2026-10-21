import { test, expect } from "@playwright/test";

// File Handling API: w Chromium plik otwarty z systemu trafia do `launchQueue`. Playwright tego nie
// symuluje, więc atrapa `launchQueue` (nadpisuje natywną właściwość) zapamiętuje konsumenta,
// a test wywołuje go plikiem Markdown.
test("plik .md otwarty z systemu otwiera import z tym plikiem", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const shim = {
      setConsumer(consumer: unknown) {
        (window as unknown as { __launch: unknown }).__launch = consumer;
      },
    };
    Object.defineProperty(window, "launchQueue", { configurable: true, get: () => shim });
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __launch?: unknown }).__launch)).toBe("function");

  await page.evaluate(() => {
    const file = new File(["# Zakupy\n\n- mleko"], "zakupy.md", { type: "text/markdown" });
    (window as unknown as { __launch: (p: unknown) => void }).__launch({ files: [{ getFile: async () => file }] });
  });

  await expect(page.getByRole("dialog", { name: "Import z Google Keep / Markdown" })).toBeVisible();
});
