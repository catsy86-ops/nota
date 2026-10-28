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

test("szablon tygodnia: zapis z tygodnia i nałożenie na pusty tydzień (G4.6)", async ({ page }) => {
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/^5–11 października 2026/);

  // Układ: poniedziałek i środa dniówką. Domyślny pędzel to pierwszy rodzaj (Urlop), więc wybieramy Dniówkę.
  await page.getByRole("radio", { name: /Dniówka/ }).click();
  await tap(page, 5);
  await tap(page, 7, "dziś, wolne$");
  await expect(page.getByRole("button", { name: day(5, "Dniówka") })).toBeVisible();

  // Zapis z paska pędzli.
  await page.getByRole("button", { name: "Szablon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szablony tygodnia" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nazwa (np. Standard)").fill("Standard");
  await dialog.getByRole("button", { name: "Zapisz ten tydzień jako szablon" }).click();
  await expect(dialog.getByRole("button", { name: "Nałóż szablon Standard na ten tydzień" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Następny tydzień jest pusty — szablon nakłada się od poniedziałku, bez ruszania innych dni.
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(/^12–18 października 2026/);
  await page.getByRole("button", { name: "Szablon tygodnia", exact: true }).click();
  await dialog.getByRole("button", { name: "Nałóż szablon Standard na ten tydzień" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: day(12, "Dniówka") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(14, "Dniówka") })).toBeVisible();
  await expect(page.getByRole("button", { name: day(13, "wolne$") })).toBeVisible();
});

test("szablon tygodnia: w widoku miesiąca nie ma zapisu tygodnia", async ({ page }) => {
  await page.getByRole("button", { name: "Szablon", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Szablony tygodnia" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Zapisz ten tydzień jako szablon" })).toHaveCount(0);
  await expect(dialog.getByText("Nie ma jeszcze szablonów.")).toBeVisible();
});

test("390 px: pasek pędzli zostaje pod nagłówkiem, gdy przewijam Grafik (G2.5)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  // Nagłówek chowa się i pokazuje animacją, więc czekamy, aż pomiar się ustali.
  const measure = () => page.evaluate(() => {
    const bar = document.querySelector('[aria-label="Zmiana do naniesienia"]')!.closest(".order-4") as HTMLElement;
    const header = document.querySelector(".app-header") as HTMLElement;
    return { gap: bar.getBoundingClientRect().top - header.getBoundingClientRect().bottom };
  });
  await expect.poll(async () => (await measure()).gap).toBeGreaterThanOrEqual(-1);
  const { gap } = await measure();
  expect(gap).toBeLessThan(24);
});
