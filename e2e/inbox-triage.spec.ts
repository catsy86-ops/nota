import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/skrzynka");
});

async function capture(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
}

test("skrzynka: porządkowanie — archiwizacja, cofnięcie, kosz i zostawienie", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Pierwsza ${stamp}`);
  await capture(page, `Druga ${stamp}`);

  await page.getByRole("button", { name: /Porządkuj skrzynkę \(2\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Archiwizuj" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Cofnij" }).click();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Kosz" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Zostaw w skrzynce" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona.");
});

test("skrzynka: „Jutro” odkłada notatkę poza Skrzynkę, „Cofnij” ją przywraca (S-1)", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Odłożona ${stamp}`);

  await page.getByRole("button", { name: /Porządkuj skrzynkę \(1\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await dialog.getByRole("button", { name: "Jutro" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona");

  await dialog.getByRole("button", { name: "Cofnij ostatnią akcję" }).click();
  await expect(dialog).toContainText("1 z 1");
});

test("skrzynka: pusty stan „Zapisz pomysł” daje kursor w polu; „Otwórz notatkę” z porządkowania (4.5, 3.2)", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Nowa notatka" })).toHaveCount(0);
  await page.getByRole("button", { name: "Zapisz pomysł" }).click();
  await expect(page.getByLabel("Przechwyć do skrzynki")).toBeFocused();

  const stamp = Date.now();
  await capture(page, `Pomysł ${stamp}`);
  await page.getByRole("button", { name: /Porządkuj skrzynkę \(1\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await dialog.getByRole("button", { name: "Otwórz notatkę" }).click();
  await expect(dialog).toBeHidden();
  // Edytor otwiera się w miejscu kafla (pole tytułu w karcie notatki).
  await expect(page.getByRole("article", { name: `Pomysł ${stamp}` }).getByRole("textbox", { name: "Tytuł" })).toHaveValue(`Pomysł ${stamp}`);
});

test("skrzynka 2.1: fraza #etykieta zapisuje z etykietą i mówi, dokąd trafiła notatka; chip da się zignorować", async ({ page }) => {
  const stamp = Date.now();
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(`Kolana ${stamp} #hurtownia jutro 9:00`);
  const chips = page.getByRole("group", { name: "Rozpoznane w tekście" });
  await expect(chips).toContainText("#hurtownia");
  await expect(chips).toContainText("Przypomnienie");
  await input.press("Enter");
  await expect(page.getByText(/Zapisano w #hurtownia · jutro/)).toBeVisible();
  // Z etykietą notatka wychodzi ze Skrzynki od razu.
  await expect(page.getByRole("main").getByText(`Kolana ${stamp}`)).toHaveCount(0);

  await input.fill(`Rury ${stamp} #hurtownia`);
  await page.getByRole("button", { name: "Zignoruj: Etykieta hurtownia" }).click();
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await expect(page.getByRole("main").getByText(`Rury ${stamp} #hurtownia`)).toBeVisible();
});
