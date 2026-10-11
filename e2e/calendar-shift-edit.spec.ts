import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy:shifts", JSON.stringify({ version: 2, days: { "2026-10-13": { type: "n" } } }));
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
});

test("kalendarz: „Jak poprzedni dzień” wpisuje zmianę, „Zmień godziny” pozwala ją poprawić ręcznie", async ({ page }) => {
  const panel = page.getByRole("region", { name: "Terminy wybranego dnia" });
  await expect(panel.getByText("Zmiana w Grafiku")).toHaveCount(0);

  await panel.getByRole("button", { name: "Jak poprzedni dzień" }).click();
  await expect(panel.getByText("Zmiana w Grafiku")).toHaveCount(1);
  await expect(panel).toContainText("Noc");

  await panel.getByRole("button", { name: "Zmień godziny" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Od", { exact: true }).fill("07:30");
  await dialog.getByLabel("Do", { exact: true }).fill("15:30");
  await dialog.getByRole("button", { name: "Zapisz dzień" }).click();

  await expect(panel).toContainText("07:30–15:30");
});

test("kalendarz: klawisz Z na siatce otwiera okno dnia z Grafiku", async ({ page }) => {
  const grid = page.getByRole("grid", { name: /Kalendarz przypomnień/ });
  await grid.getByRole("gridcell").first().focus();
  await page.keyboard.press("z");
  await expect(page.getByRole("dialog").getByText("Godziny tego dnia").or(page.getByRole("dialog").getByText("Zmiana").first())).toBeVisible();
});
