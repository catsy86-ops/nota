import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// K3.6: tydzień z osią godzin na xl. Środa 14.10.2026 — kolumna 2 (pn = 0), piątek = kolumna 4.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test.describe("komputer (xl)", () => {
  test.use({ viewport: { width: 1400, height: 1200 } });

  test("oś tygodnia: termin stoi w swojej kolumnie i godzinie, przeciągnięcie przenosi go na inny dzień i godzinę", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Kalendarz/ }).first().click();

    // Termin na dziś, 15:00.
    await page.getByRole("button", { name: "Dodaj termin" }).click();
    await page.getByLabel("Treść nowej notatki z terminem").fill("spotkanie test");
    await page.getByLabel("Godzina przypomnienia").fill("15:00");
    await page.getByRole("button", { name: /Utwórz notatkę z terminem/ }).click();

    await page.getByRole("button", { name: "Oś tygodnia" }).click();
    await expect(page.getByRole("button", { name: "Oś tygodnia" })).toHaveAttribute("aria-pressed", "true");
    // Siatka miesiąca ustępuje osi (ukryta na xl).
    await expect(page.getByRole("grid", { name: /Kalendarz przypomnień/ })).toBeHidden();

    const wed = page.locator('[data-week-col="2"]');
    const chip = wed.locator('[aria-label^="Edytuj termin: spotkanie test"]');
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveAttribute("aria-label", "Edytuj termin: spotkanie test, 15:00");

    // Przeciągnięcie: środa 15:00 → piątek 17:00. Oś zaczyna się o 7:00, wiersz to 44 px.
    // Oś może leżeć pod zgięciem: przewijamy, zanim zmierzymy punkty przeciągnięcia.
    await chip.scrollIntoViewIfNeeded();
    const box = await chip.boundingBox();
    const fri = await page.locator('[data-week-col="4"]').boundingBox();
    expect(box && fri).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(fri!.x + fri!.width / 2, fri!.y + (17 - 7) * 44 + 10, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByText("Termin przeniesiony na 16 października")).toBeVisible();
    await expect(page.locator('[data-week-col="4"] [aria-label="Edytuj termin: spotkanie test, 17:00"]')).toHaveCount(1);
    await expect(wed.locator('[aria-label^="Edytuj termin: spotkanie test"]')).toHaveCount(0);
  });

  test("oś tygodnia przechodzi axe (WCAG 2.2 AA)", async ({ page }) => {
    await page.goto("/kalendarz");
    await page.getByRole("button", { name: "Oś tygodnia" }).click();
    await expect(page.locator('[data-week-col="2"]')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("oś tygodnia nie pojawia się poniżej xl", async ({ page }) => {
    await page.goto("/kalendarz");
    await expect(page.getByRole("button", { name: "Oś tygodnia" })).toBeHidden();
  });
});
