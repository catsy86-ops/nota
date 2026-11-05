import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";
import { editorBody } from "./helpers/editor";

// Nowy plan 2026-11-05, Etap 6: porównanie wersji słowami i „Przywróć tylko ten akapit” (6.2),
// „Opisz na zdjęciu” w galerii notatki (6.3), zapisane widoki w pasku bocznym (6.1).

const NOW = new Date(2026, 9, 14, 12, 0);
const T = NOW.getTime();
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const note = (id: string, title: string, content: string, extra: Record<string, unknown> = {}) => ({
  id, title, content, color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T, ...extra,
});
const card = (page: Page, title: string) => page.locator("[data-note-id]").filter({ hasText: title });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("historia wersji: zmiany w tekście, obok, i przywrócenie jednego akapitu (6.2)", async ({ page }) => {
  await seedNotes(page, [note("a", "Plan", "Wstęp\n\nStary akapit\n\nKoniec")]);
  await page.goto("/");
  await page.getByText("Plan", { exact: true }).click();
  await editorBody(card(page, "Plan")).fill("Wstęp\n\nNowy akapit\n\nKoniec");
  await card(page, "Plan").getByRole("button", { name: "Zapisz", exact: true }).click();

  await card(page, "Plan").hover();
  await card(page, "Plan").getByRole("button", { name: "Więcej opcji" }).click();
  await card(page, "Plan").getByRole("button", { name: "Historia wersji" }).click();
  const dialog = page.getByRole("dialog", { name: "Historia wersji" });
  await dialog.getByRole("button", { name: /Plan/ }).first().click();

  await dialog.getByRole("radio", { name: "Zmiany w tekście" }).click();
  const inline = dialog.getByTestId("version-diff-inline");
  await expect(inline.locator("del")).toContainText("Stary");
  await expect(inline.locator("ins")).toContainText("Nowy");

  await dialog.getByRole("radio", { name: "Obok" }).click();
  await dialog.getByRole("button", { name: "Przywróć tylko ten akapit" }).click();
  await expect(card(page, "Plan")).toContainText("Stary akapit");
  await expect(card(page, "Plan")).not.toContainText("Nowy akapit");
});

test("galeria notatki: „Opisz na zdjęciu” dodaje opisaną kopię, oryginał zostaje (6.3)", async ({ page }) => {
  await seedNotes(page, [note("a", "Zdjęcie", "Treść")]);
  await page.goto("/");
  await page.getByText("Zdjęcie", { exact: true }).click();
  await card(page, "Zdjęcie").getByRole("button", { name: "Więcej opcji" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    card(page, "Zdjęcie").getByRole("button", { name: "Dodaj obrazek" }).click(),
  ]);
  await chooser.setFiles({ name: "kropka.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await card(page, "Zdjęcie").getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.keyboard.press("Escape");

  // Podgląd (Spacja na kaflu), klik w obraz otwiera galerię.
  await page.locator("body").click({ position: { x: 1200, y: 860 } });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: /Powiększ obraz 1 z 1/ }).click();
  await page.getByRole("button", { name: "Opisz na zdjęciu" }).click();
  const canvas = page.locator("canvas").last();
  const save = page.getByRole("button", { name: "Zapisz rysunek" });
  // Okno rysunku wjeżdża animacją — kreska narysowana w trakcie może się nie zarejestrować, więc powtarzamy aż „Zapisz” się włączy.
  await canvas.waitFor();
  await page.waitForTimeout(400);
  for (let i = 0; i < 3 && await save.isDisabled(); i++) {
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + 30);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, box.y + 80, { steps: 6 });
    await page.mouse.up();
  }
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Dodano opisane zdjęcie — oryginał został")).toBeVisible();
  await expect(page.getByRole("button", { name: /Powiększ obraz 2 z 2/ })).toBeVisible();
});

test("zapisany widok: zapis z folderu z układem, potem otwarcie z innego miejsca (6.1)", async ({ page }) => {
  await seedNotes(page, [note("a", "Beton", "zamówić beton"), note("b", "Piwo", "piątek")]);
  await page.goto("/");
  await page.getByRole("searchbox").first().fill("beton");
  await expect(card(page, "Piwo")).toHaveCount(0);

  await page.getByRole("button", { name: "Zapisz bieżący widok" }).click();
  await page.getByPlaceholder("Nazwa...").fill("Budowa");
  await page.getByPlaceholder("Nazwa...").press("Enter");
  await expect(page.getByText("Zapisano widok „Budowa”")).toBeVisible();

  // Inny stan: czyste szukanie, inny dział. Widok przywraca zapytanie.
  await page.getByRole("searchbox").first().fill("");
  await page.getByRole("button", { name: "Kalendarz" }).first().click();
  await page.locator("[data-saved-views]").getByRole("button", { name: "Budowa" }).click();
  await expect(page).toHaveURL(/q=beton/);
  await expect(card(page, "Beton")).toBeVisible();
  await expect(card(page, "Piwo")).toHaveCount(0);
});
