import { test, expect, type Page } from "@playwright/test";

// Środa 7 października 2026 — tydzień 5–11 października, bez świąt.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

const day = (n: number, rest: string) => new RegExp(`^${n} [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, ${rest}`);

async function tap(page: Page, n: number, rest = "wolne$") {
  await page.getByRole("button", { name: day(n, rest) }).first().click();
}

/** Przeciągnięcie myszą z kilkoma ruchami — dnd-kit rusza po 8 px. */
async function drag(page: Page, from: number, to: number, opts: { alt?: boolean } = {}) {
  // Środek okna: przy krawędzi dnd-kit przewija stronę w trakcie przeciągania.
  await page.getByRole("button", { name: day(from, "") }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
  const a = (await page.getByRole("button", { name: day(from, "") }).first().boundingBox())!;
  const b = (await page.getByRole("button", { name: day(to, "") }).first().boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, { steps: 4 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 });
  if (opts.alt) await page.keyboard.down("Alt");
  await page.mouse.up();
  if (opts.alt) await page.keyboard.up("Alt");
}

test("widok tygodnia: przełącznik, nawigacja, pędzel i pamięć wyboru", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("5–11 października 2026");
  await expect(page.getByRole("grid", { name: /^Tydzień 5 października – 11 października 2026$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ten tydzień", exact: true })).toHaveCount(0);

  // Pędzel „Dzień” — jak w miesiącu.
  await tap(page, 7, "dziś, wolne$");
  await expect(page.getByRole("button", { name: /^7 października, środa, dziś, Dzień/ })).toBeVisible();

  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("12–18 października 2026");
  await page.getByRole("button", { name: "Ten tydzień", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("5–11 października 2026");

  await page.reload();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("5–11 października 2026");
  await page.getByRole("button", { name: "Miesiąc", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("październik 2026");
});

test("tydzień przechodzi przez przełom miesiąca", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  // 26 października – 1 listopada.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("26 października – 1 listopada 2026");
});

test("przeciągnięcie przenosi zmianę, Cofnij ją przywraca", async ({ page }) => {
  await tap(page, 5);
  await expect(page.getByRole("button", { name: day(5, "Dzień") })).toBeVisible();

  await drag(page, 5, 8);
  await expect(page.getByRole("button", { name: day(8, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(5, "wolne$") })).toBeVisible();

  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("button", { name: day(5, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(8, "wolne$") })).toBeVisible();
});

test("przeciągnięcie z Alt kopiuje zmianę", async ({ page }) => {
  await tap(page, 5);
  await drag(page, 5, 8, { alt: true });
  await expect(page.getByRole("button", { name: day(8, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(5, "Dzień") })).toBeVisible();
});

test("przeciągnięcie działa też w widoku tygodnia", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await tap(page, 6);
  await drag(page, 6, 9);
  await expect(page.getByRole("button", { name: day(9, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(6, "wolne$") })).toBeVisible();
});

test("klawiatura: Shift+strzałka przenosi, Ctrl+C i Ctrl+V kopiują wpis", async ({ page }) => {
  await tap(page, 5);
  const five = page.getByRole("button", { name: day(5, "Dzień") });
  await five.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("button", { name: day(6, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(5, "wolne$") })).toBeVisible();
  // Fokus idzie za zmianą — drugie naciśnięcie przesuwa ją dalej.
  await page.keyboard.press("Shift+ArrowRight");
  await expect(page.getByRole("button", { name: day(7, "dziś, Dzień") })).toBeVisible();

  await page.keyboard.press("Control+c");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Control+v");
  await expect(page.getByRole("button", { name: day(9, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(7, "dziś, Dzień") })).toBeVisible();
});

test("kopiowanie tygodnia na pusty tydzień da się cofnąć", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await tap(page, 5);
  await tap(page, 6);
  await page.getByRole("radio", { name: /Noc/ }).click();
  await tap(page, 7, "dziś, wolne$");

  await page.getByRole("button", { name: "Skopiuj ten tydzień na następny" }).click();
  // Następny tydzień jest pusty — nic nie nadpisuje, więc bez pytania.
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(page.getByRole("button", { name: day(12, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(13, "Dzień") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(14, "Noc") })).toBeVisible();

  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("button", { name: day(13, "wolne$") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(12, "wolne$") })).toBeVisible();
});

test("kopiowanie tygodnia pyta, gdy nadpisze inny wpis", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await tap(page, 5);
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await page.getByRole("radio", { name: /Noc/ }).click();
  await tap(page, 12);
  await page.getByRole("button", { name: "Poprzedni tydzień" }).click();

  await page.getByRole("button", { name: "Skopiuj ten tydzień na następny" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Nadpisać 1 dzień");
  await dialog.getByRole("button", { name: "Anuluj" }).click();
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(page.getByRole("button", { name: day(12, "Noc") })).toBeVisible();
  await page.getByRole("button", { name: "Poprzedni tydzień" }).click();

  await page.getByRole("button", { name: "Skopiuj ten tydzień na następny" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Nadpisz i skopiuj" }).click();
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(page.getByRole("button", { name: day(12, "Dzień") })).toBeVisible();
});

test("widok tygodnia pokazuje terminy z Kalendarza jako podgląd", async ({ page }) => {
  await page.getByRole("button", { name: /Kalendarz/ }).first().click();
  await page.getByRole("button", { name: "Dodaj termin" }).click();
  await page.getByLabel("Treść nowej notatki z terminem").fill("jutro odebrac paczke");
  await page.getByLabel("Godzina przypomnienia").fill("18:30");
  await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

  // Pasek tygodnia w Kalendarzu: 8 października ma 1 termin.
  await expect(page.getByRole("button", { name: /^8 października, czwartek.*1 termin$/ })).toBeVisible();

  await page.getByRole("button", { name: /Grafik/ }).first().click();
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  const thursday = page.getByRole("button", { name: day(8, "") }).first();
  await expect(thursday).toHaveAccessibleName(/terminy: 18:30 odebrac paczke/);
  await expect(thursday).toContainText("odebrac paczke");
});

test("390 px: widok tygodnia bez poziomego przewijania", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await tap(page, 7, "dziś, wolne$");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
