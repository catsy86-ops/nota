import { test, expect } from "@playwright/test";

// Notatka głosowa: sztuczny mikrofon Chromium nagrywa ton; plik trafia do załączników z odtwarzaczem.
test.use({
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("nagranie notatki głosowej w nowej notatce: pasek z czasem, Zatrzymaj, załącznik z odtwarzaczem", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "sztuczny mikrofon tylko w Chromium");
  await page.goto("/");
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Pomiar z łazienki");

  await page.getByRole("button", { name: "Nagraj notatkę głosową" }).click();
  const bar = page.getByTestId("voice-recording");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("/ 3:00");
  await page.waitForTimeout(1500);
  await bar.getByRole("button", { name: "Zatrzymaj" }).click();

  await expect(bar).toHaveCount(0);
  const row = page.getByTestId("attachment-row").filter({ hasText: /Nagranie \d{4}-\d{2}-\d{2} \d{2}-\d{2}\.(webm|m4a)/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Nagranie ·");
  await expect(row.getByTestId("attachment-audio")).toBeVisible();

  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Pomiar z łazienki" }).getByTestId("attachments-badge")).toHaveText("1");
});
