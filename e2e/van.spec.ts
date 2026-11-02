import { test, expect, type Page } from "@playwright/test";

// H1.3 Materiał w aucie: pozycja ze stanem i minimum, zużycie z wpisu „z auta”, „Dostawa na budowę”
// się nie liczy, przyjęcie, „Do auta” na liście do hurtowni.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "old", at: new Date(2026, 10, 2, 8).getTime(), kind: "ok", topic: null, text: "Rano", site: "Lipowa 5", checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 2 }] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

async function entryWithKolano(page: Page, qty: number, delivery = false) {
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  const box = sheet.getByTestId("fittings");
  // Pole kształtek zostaje otwarte po poprzednim wpisie — otwieramy tylko, gdy go nie ma.
  if (!(await box.isVisible())) await sheet.getByRole("button", { name: /^(\+ |✓ )?Kształtki$/ }).click();
  await box.getByRole("button", { name: "Kolano 16" }).first().click();
  for (let i = 1; i < qty; i++) await box.getByRole("button", { name: "Kolano 16: więcej" }).click();
  const supply = sheet.getByTestId("entry-supply");
  await expect(supply.getByRole("button", { name: "Z auta" })).toHaveAttribute("aria-pressed", "true");
  if (delivery) await supply.getByRole("button", { name: "Dostawa na budowę" }).click();
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
}

test("auto: stan, zużycie z auta, dostawa na budowę, przyjęcie i „Do auta” w hurtowni", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("van-open").click();
  const dialog = page.getByTestId("van-dialog");
  await dialog.getByLabel("Nazwa pozycji w aucie").fill("Kolano 16");
  await dialog.getByLabel("Stan teraz").fill("20");
  await dialog.getByLabel("Minimum").fill("18");
  await dialog.getByRole("button", { name: "Dodaj" }).click();
  await expect(dialog.getByTestId("van-qty")).toHaveText("20 szt.");
  await page.keyboard.press("Escape");

  await page.clock.setFixedTime(new Date(2026, 10, 2, 13, 0).getTime());
  await entryWithKolano(page, 3);
  await page.clock.setFixedTime(new Date(2026, 10, 2, 14, 0).getTime());
  await entryWithKolano(page, 4, true);

  // 20 − 3 z auta = 17 (dostawa 4 szt. na budowę się nie liczy), minimum 18 → dokupić 1.
  await expect(page.getByTestId("van-open")).toContainText("dokupić 1");
  await page.getByTestId("wholesale-open").click();
  await expect(page.getByTestId("wholesale-van")).toContainText("Kolano 16");
  await expect(page.getByTestId("wholesale-van")).toContainText("1 szt.");
  await page.keyboard.press("Escape");

  await page.getByTestId("van-open").click();
  await expect(dialog.getByTestId("van-qty")).toHaveText("17 szt.");
  await expect(dialog.getByTestId("van-to-buy")).toHaveText("Do dokupienia: Kolano 16 1 szt.");
  await dialog.getByRole("button", { name: "+ Przyjęcie" }).click();
  await dialog.getByLabel("Przyjęcie: Kolano 16 (szt.)").fill("5");
  await dialog.getByRole("button", { name: "Zapisz" }).click();
  await expect(dialog.getByTestId("van-qty")).toHaveText("22 szt.");
  await expect(dialog.getByTestId("van-to-buy")).toHaveCount(0);
}, { timeout: 60000 });
