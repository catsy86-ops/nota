import { test, expect } from "@playwright/test";

// Zestawy materiału (H1.2): pigułka zestawu dopisuje kształtki i rury do wpisu; własny zestaw z okna edycji.

test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Lipowa 5", journal: [] }));
  });
});

test("przykładowy zestaw dopisuje kształtki i rury; drugi raz sumuje @mobile", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: "+ Zestaw" }).click();
  await sheet.getByTestId("journal-kits").getByRole("button", { name: /^Podejście umywalki/ }).click();
  await expect(sheet.getByTestId("journal-kits")).toHaveCount(0);
  await expect(sheet.getByTestId("fittings").getByTestId("fitting-qty")).toHaveText(["2", "2", "1"]);
  await expect(sheet.getByTestId("pipes").getByLabel("Rura PEX 16×2: metry")).toHaveValue("3");

  await sheet.getByRole("button", { name: "+ Zestaw" }).click();
  await sheet.getByTestId("journal-kits").getByRole("button", { name: /^Podejście umywalki/ }).click();
  await expect(sheet.getByTestId("fittings").getByTestId("fitting-qty")).toHaveText(["4", "4", "2"]);

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("journal-fittings").first()).toHaveText("Kolano naścienne 16 × 4, Trójnik 16 × 4, Kolano 50/45° × 2");
  await expect(page.getByTestId("journal-pipes").first()).toHaveText("Rura PEX 16×2: 6 m, Rura PVC 50: 2 m");
});

test("nowy zestaw z okna edycji; pusty zestaw z komunikatem; zostaje po odświeżeniu @mobile", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: "+ Zestaw" }).click();
  await sheet.getByRole("button", { name: "Zmień zestawy" }).click();
  const dialog = page.getByTestId("kits-dialog");
  await dialog.getByRole("button", { name: "Nowy zestaw" }).click();
  const form = dialog.getByTestId("kit-form");
  await form.getByLabel("Nazwa").fill("Kotłownia");
  await form.getByRole("button", { name: "Zapisz zestaw" }).click();
  await expect(form.getByRole("alert")).toHaveText("Dodaj co najmniej jedną kształtkę albo rurę z długością.");

  await form.getByTestId("fittings").getByRole("button", { name: "Trójnik 16" }).click();
  await form.getByTestId("pipes").getByRole("button", { name: "Rura PEX 20×2" }).click();
  await form.getByLabel("Rura PEX 20×2: metry").fill("2,5");
  await form.getByRole("button", { name: "Zapisz zestaw" }).click();
  await expect(dialog.getByRole("list", { name: "Zestawy" })).toContainText("Kotłownia");
  await expect(dialog.getByRole("list", { name: "Zestawy" })).toContainText("1 szt. · 2,5 m rur");
  await page.keyboard.press("Escape");

  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  await sheet.getByRole("button", { name: "+ Zestaw" }).click();
  await expect(sheet.getByTestId("journal-kits").getByRole("button", { name: /^Kotłownia/ })).toBeVisible();
});
