import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// Karta budowy w segmentach (plan Pracy na budowie, B2.2): Dziś · Materiał · Punkty · Pieniądze · Papiery.
test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: Date.now() - 3_600_000, kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

async function openCard(page: import("@playwright/test").Page) {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  await expect(card).toBeVisible();
  return card;
}

test("pięć segmentów, start na Dziś; panele leżą w swoich segmentach @mobile", async ({ page }) => {
  const card = await openCard(page);
  const bar = card.getByRole("tablist", { name: "Sekcje karty budowy" });
  await expect(bar.getByRole("tab")).toHaveText(["Dziś", "Materiał", "Punkty", "Pieniądze", "Papiery"]);
  await expect(bar.getByRole("tab", { name: "Dziś" })).toHaveAttribute("data-state", "active");
  await expect(card.getByTestId("site-stages")).toBeVisible();
  await expect(card.getByTestId("site-shortages")).toBeHidden();

  await bar.getByRole("tab", { name: "Materiał" }).click();
  await expect(card.getByTestId("site-shortages")).toBeVisible();
  await expect(card.getByTestId("site-order")).toBeVisible();
  await expect(card.getByTestId("site-stages")).toBeHidden();

  await bar.getByRole("tab", { name: "Papiery" }).click();
  await expect(card.getByTestId("site-data")).toBeVisible();
  await expect(card.getByTestId("site-docs")).toBeVisible();
  // „Pokaż wpisy” i „Raport” zostają nad segmentami.
  await expect(card.getByRole("button", { name: "Raport", exact: true })).toBeVisible();
});

test("licznik „Braki” przełącza segment; wpisany tekst przeżywa zmianę segmentu @mobile", async ({ page }) => {
  const card = await openCard(page);
  await card.getByTestId("site-tally").getByRole("button", { name: /^Braki/ }).click();
  await expect(card.getByRole("tab", { name: "Materiał" })).toHaveAttribute("data-state", "active");
  await card.getByTestId("site-shortages").getByLabel("Czego brakuje").fill("Rura PEX 16");
  await card.getByRole("tab", { name: "Punkty" }).click();
  await card.getByRole("tab", { name: "Materiał" }).click();
  await expect(card.getByTestId("site-shortages").getByLabel("Czego brakuje")).toHaveValue("Rura PEX 16");
});

test("karta wraca do ostatniego segmentu tej budowy @mobile", async ({ page }) => {
  const card = await openCard(page);
  await card.getByRole("tab", { name: "Punkty" }).click();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  await expect(page.getByTestId("site-card").getByRole("tab", { name: "Punkty" })).toHaveAttribute("data-state", "active");
});

test("na 390 px wszystkie pięć segmentów mieści się bez przewijania paska; karta bez naruszeń axe @mobile", async ({ page }) => {
  const card = await openCard(page);
  const bar = card.getByRole("tablist", { name: "Sekcje karty budowy" });
  const fits = await bar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(fits, "pasek segmentów przewija się w bok").toBe(true);
  const result = await new AxeBuilder({ page }).include('[data-testid="site-card"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});
