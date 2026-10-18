import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Pinezka to część efektu „Iskierki” (domyślnie wyłączonego), więc test włącza go jawnie.
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.effectsSettings.defaults2", "1");
    localStorage.setItem("kaczy.effectsSettings.v1", JSON.stringify({ sparkle: true }));
  });
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
}

test("po przypięciu na karcie pojawia się pinezka", async ({ page }) => {
  const title = `E2E-stempel ${Date.now()}`;
  await addNote(page, title);

  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypnij" }).click();

  // Karta trafia do sekcji „Przypięte” i montuje się od nowa — stempel dotyczy nowej karty.
  await expect(page.getByText("Przypięte")).toBeVisible();
  await expect(page.locator("[data-note-id-wrap]", { hasText: title }).locator(".pin-stamp")).toHaveCount(1);
});

test("wyjście karty do kosza usuwa ją z DOM", async ({ page }) => {
  const title = `E2E-wyjscie ${Date.now()}`;
  await addNote(page, title);
  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await expect(card).toHaveCount(1);

  await card.hover();
  await card.getByLabel(/usuń/i).click();
  await page.getByRole("button", { name: "Przenieś do kosza" }).click();

  await expect(page.locator("[data-note-id-wrap]", { hasText: title })).toHaveCount(0);
});

test("przy reduced motion pinezka się nie pojawia", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const title = `E2E-reduced ${Date.now()}`;
  await addNote(page, title);

  const card = page.locator("[data-note-id-wrap]", { hasText: title });
  await card.hover();
  await card.getByRole("button", { name: "Przypnij" }).click();
  await expect(page.getByText("Przypięte")).toBeVisible();
  await expect(page.locator(".pin-stamp")).toHaveCount(0);
});
