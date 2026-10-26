import { test, expect } from "@playwright/test";

// Masa ciała (C-2): zapis ważenia dnia, trend i cofnięcie usunięcia w Ćwiczeniach.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("masa ciała: zapis ważenia z przecinkiem, trend i usunięcie z cofnięciem", async ({ page }, testInfo) => {
  await page.goto("/cwiczenia");
  if (testInfo.project.name.includes("iphone")) {
    await page.getByRole("group", { name: "Dział Ćwiczeń" }).getByRole("button", { name: "Waga" }).click();
  }
  await expect(page.getByRole("heading", { name: "Masa ciała" })).toBeVisible();

  await page.getByLabel("Masa w kilogramach").fill("82,4");
  await page.getByRole("button", { name: "Zapisz ważenie" }).click();
  await expect(page.getByTestId("weight-trend")).toContainText("Pierwsze ważenie.");
  await expect(page.getByTestId("weight-list")).toContainText("82.4 kg");

  await page.getByRole("button", { name: /^Usuń ważenie z / }).click();
  await expect(page.getByText("Zapisz pierwsze ważenie.")).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByTestId("weight-list")).toContainText("82.4 kg");
});

test("masa ciała: poza zakresem nie zapisuje się", async ({ page }, testInfo) => {
  await page.goto("/cwiczenia");
  if (testInfo.project.name.includes("iphone")) {
    await page.getByRole("group", { name: "Dział Ćwiczeń" }).getByRole("button", { name: "Waga" }).click();
  }
  await page.getByLabel("Masa w kilogramach").fill("5");
  await page.getByRole("button", { name: "Zapisz ważenie" }).click();
  await expect(page.getByText("Podaj masę od 20 do 300 kg")).toBeVisible();
  await expect(page.getByText("Zapisz pierwsze ważenie.")).toBeVisible();
});
