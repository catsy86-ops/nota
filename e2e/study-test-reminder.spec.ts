import { test, expect } from "@playwright/test";

test("praca: przypomnienie „bez protokołu próby” otwiera wpis próby dla tej budowy", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded-test-reminder")) return;
    sessionStorage.setItem("seeded-test-reminder", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const now = Date.now();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [{
        id: "montaz", at: now - 60_000, kind: "ok", topic: null, text: "Montaż pionu",
        site: "Lipowa 9", checked: [], images: [], fittings: [{ name: "Trójnik", qty: 1 }],
      }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();

  const reminders = page.getByTestId("journal-reminders");
  await expect(reminders).toContainText("bez protokołu próby");
  await reminders.getByRole("button", { name: "Dodaj próbę" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Lipowa 9");
});
