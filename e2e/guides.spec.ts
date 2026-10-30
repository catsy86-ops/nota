import { test, expect } from "@playwright/test";

// Samouczek (2026-10-30): wybór działów na pierwszej karcie, Wstecz/Dalej, strzałki; przewodnik Pracy
// przy pierwszym wejściu i z „?”; podpowiedź Grafiku raz. `kaczy.guides.force` — podpowiedzi także pod webdriverem.

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test("samouczek na start: wybór działów zmienia karty, Wstecz, strzałki, zamknięcie zapamiętane @mobile", async ({ page }) => {
  await page.goto("/");
  const tour = page.getByTestId("onboarding-tour");
  await expect(tour.getByRole("heading", { name: "Witaj w notkach" })).toBeVisible();
  await expect(tour.getByRole("group", { name: "Karty przewodnika" }).getByRole("button")).toHaveCount(9);
  await tour.getByRole("button", { name: "Grafik", exact: true }).click();
  await tour.getByRole("button", { name: "Praca na budowie" }).click();
  await expect(tour.getByRole("button", { name: "Grafik", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(tour.getByRole("group", { name: "Karty przewodnika" }).getByRole("button")).toHaveCount(7);

  await tour.getByRole("button", { name: "Dalej" }).click();
  await expect(tour.getByRole("heading", { name: "Zapisz myśl w sekundę" })).toBeVisible();
  await expect(tour.getByText("Stuknij duży + na dole")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(tour.getByRole("heading", { name: "Znajdź wszystko" })).toBeVisible();
  await tour.getByRole("button", { name: "Wstecz" }).click();
  await expect(tour.getByRole("heading", { name: "Zapisz myśl w sekundę" })).toBeVisible();
  await tour.getByRole("button", { name: /^Karta 7:/ }).click();
  await expect(tour.getByRole("heading", { name: "Twoje dane, Twoje urządzenia" })).toBeVisible();
  await tour.getByRole("button", { name: "Zaczynamy" }).click();
  await expect(tour).toBeHidden();

  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("onboarding-tour")).toHaveCount(0);
});

test("przewodnik Pracy: sam przy pierwszym wejściu, raz; potem z „?” @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    localStorage.setItem("kaczy.guides.force", "1");
  });
  await page.goto("/praca");
  const guide = page.getByTestId("work-guide");
  await expect(guide.getByRole("heading", { name: "Wpis z budowy" })).toBeVisible();
  for (let i = 0; i < 4; i++) await guide.getByRole("button", { name: "Dalej" }).click();
  await expect(guide.getByRole("heading", { name: "Rozliczenie i raport" })).toBeVisible();
  await guide.getByRole("button", { name: "Do roboty" }).click();
  await expect(guide).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("study-view")).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByTestId("work-guide")).toHaveCount(0);
  await page.getByRole("button", { name: "Przewodnik po Pracy" }).click();
  await expect(page.getByTestId("work-guide").getByRole("heading", { name: "Wpis z budowy" })).toBeVisible();
});

test("podpowiedź Grafiku: raz, zamknięta nie wraca @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.guides.force", "1");
  });
  await page.goto("/grafik");
  const hint = page.getByTestId("shifts-hint");
  await expect(hint).toContainText("Pierwszy raz w Grafiku?");
  await hint.getByRole("button", { name: "Zamknij podpowiedź" }).click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: /^Grafik:/ })).toBeVisible();
  await expect(page.getByTestId("shifts-hint")).toHaveCount(0);
});
