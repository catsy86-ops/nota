import { test, expect } from "@playwright/test";

// 1.1 planu Praca 2026-10-24: „+ Wpis” bierze budowę z filtra dziennika, karta budowy ma „+ Wpis tutaj”.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded-context-site")) return;
    sessionStorage.setItem("seeded-context-site", "1");
    const now = Date.now();
    const e = (id: string, at: number, site: string, text: string) => ({ id, at, kind: "ok", topic: null, text, site, checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Polna 2",
      journal: [e("a", now - 60_000, "Lipowa 5", "Piony w łazience"), e("b", now - 120_000, "Polna 2", "Kanalizacja w garażu")],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
});

test("„+ Wpis” przy filtrze budowy otwiera arkusz z tą budową", async ({ page }) => {
  const journal = page.getByTestId("study-journal");
  await journal.getByRole("group", { name: "Budowa" }).getByRole("button", { name: "Lipowa 5" }).click();
  await journal.getByRole("button", { name: /^Wpis$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("button", { name: "Budowa: Lipowa 5. Zmień" })).toBeVisible();

  // Bez filtra budowa zostaje taka, jak była ostatnio w arkuszu.
  await page.keyboard.press("Escape");
  await journal.getByRole("group", { name: "Budowa" }).getByRole("button", { name: "Wszystkie budowy" }).click();
  await journal.getByRole("button", { name: /^Wpis$/ }).click();
  await expect(sheet.getByRole("button", { name: "Budowa: Lipowa 5. Zmień" })).toBeVisible();
});

test("karta budowy: „Wpis tutaj” zamyka kartę i otwiera arkusz z tą budową", async ({ page }) => {
  const journal = page.getByTestId("study-journal");
  await journal.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await card.getByRole("button", { name: "Wpis tutaj" }).click();
  await expect(card).toBeHidden();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("button", { name: "Budowa: Lipowa 5. Zmień" })).toBeVisible();
  await sheet.getByLabel("Co się dzieje?").fill("Podejścia pod umywalkę");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(journal.locator("[data-journal-entry]").filter({ hasText: "Podejścia pod umywalkę" })).toBeVisible();
  await expect(journal.locator("section[data-journal-day]").first().locator("[data-journal-site]").first()).toHaveText("Lipowa 5");
});
