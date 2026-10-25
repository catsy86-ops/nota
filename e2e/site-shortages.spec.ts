import { test, expect, type Page } from "@playwright/test";

// Braki materiału w karcie budowy (status brakuje → zamówione → dostarczone) i historia zamówień kształtek.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { w.__copied = t; } } });
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 3 }] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("braki: dopisanie, status, kopia, czyszczenie z Cofnij, raport; historia zamówień; po przeładowaniu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  const panel = card.getByTestId("site-shortages");

  await panel.getByLabel("Czego brakuje").fill("Rura PEX 16");
  await panel.getByLabel("Ile").fill("50 m");
  await panel.getByRole("button", { name: "Dodaj brak" }).click();
  await panel.getByLabel("Czego brakuje").fill("Klej PCV");
  await panel.getByRole("button", { name: "Dodaj brak" }).click();
  await expect(panel.locator("[data-shortage-status]")).toHaveCount(2);
  await expect(panel.getByTestId("site-shortages-open")).toHaveText("2 w drodze lub brak");

  await panel.getByRole("button", { name: "Klej PCV: Brakuje. Zmień status" }).click();
  await expect(panel.getByRole("button", { name: "Klej PCV: Zamówione. Zmień status" })).toBeVisible();

  await panel.getByRole("button", { name: "Kopiuj braki" }).click();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string }).__copied);
  expect(copied).toBe("Braki materiału — Lipowa 5\n- Rura PEX 16: 50 m — brakuje\n- Klej PCV — zamówione 14.10");

  // Klej dojechał: zamówione → dostarczone; czyszczenie dostarczonych ma „Cofnij”.
  await panel.getByRole("button", { name: "Klej PCV: Zamówione. Zmień status" }).click();
  await expect(panel.getByTestId("site-shortages-open")).toHaveText("1 w drodze lub brak");
  await panel.getByRole("button", { name: "Wyczyść dostarczone (1)" }).click();
  await expect(panel.locator("[data-shortage-status]")).toHaveCount(1);
  await page.locator("[data-sonner-toast]").filter({ hasText: "Wyczyszczono dostarczone" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(panel.locator("[data-shortage-status]")).toHaveCount(2);

  // Zamówienie kształtek trafia do historii.
  const order = card.getByTestId("site-order");
  await order.getByRole("button", { name: "Oznacz jako zamówione" }).click();
  const history = order.getByTestId("site-order-history");
  await history.locator("summary").click();
  await expect(history).toContainText("Poprzednie zamówienia (1)");
  await expect(history).toContainText("14.10 — Kolano 16 × 3");

  // Raport z karty: tylko niedostarczone braki.
  await card.getByRole("button", { name: "Raport", exact: true }).click();
  const report = page.getByTestId("journal-report");
  const section = report.locator("[data-report-shortages]");
  await expect(section).toContainText("Rura PEX 16: 50 m — zamówione 14.10");
  await expect(section).not.toContainText("Klej PCV");
  await expect(report).toContainText("braki materiału: 1");
  await page.keyboard.press("Escape");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const after = page.getByTestId("site-card");
  await expect(after.getByTestId("site-shortages").locator("[data-shortage-status]")).toHaveCount(2);
  await expect(after.getByTestId("site-order-history")).toContainText("Poprzednie zamówienia (1)");
});

test("zamówione ponad 3 dni temu i niedostarczone: przypomnienie nad dziennikiem prowadzi do karty budowy", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const panel = page.getByTestId("site-card").getByTestId("site-shortages");
  await panel.getByLabel("Czego brakuje").fill("Klej PCV");
  await panel.getByRole("button", { name: "Dodaj brak" }).click();
  await panel.getByRole("button", { name: "Klej PCV: Brakuje. Zmień status" }).click();
  await expect(panel.getByRole("button", { name: "Klej PCV: Zamówione. Zmień status" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("journal-reminders").locator('[data-reminder="late-order"]')).toHaveCount(0);

  // Cztery dni później materiał wciąż „zamówiony”.
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(2026, 9, 18, 12, 0).getTime());
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const reminder = page.getByTestId("journal-reminders").locator('[data-reminder="late-order"]');
  await expect(reminder).toContainText("Budowa „Lipowa 5”: zamówione ponad 3 dni temu i nie dojechało — Klej PCV.");
  await reminder.getByRole("button", { name: "Karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await card.getByTestId("site-shortages").getByRole("button", { name: "Klej PCV: Zamówione. Zmień status" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("journal-reminders").locator('[data-reminder="late-order"]')).toHaveCount(0);
});

test("braki: po zmianie statusu czytnik dostaje komunikat, po usunięciu fokus wraca do pola dodawania", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const panel = page.getByTestId("site-card").getByTestId("site-shortages");

  await panel.getByLabel("Czego brakuje").fill("Złączka 20");
  await panel.getByRole("button", { name: "Dodaj brak" }).click();
  await panel.getByRole("button", { name: /Złączka 20: Brakuje/ }).click();
  await expect(panel.getByRole("status")).toHaveText("Złączka 20: Zamówione");

  await panel.getByRole("button", { name: "Usuń brak: Złączka 20" }).click();
  await expect(panel.getByLabel("Czego brakuje")).toBeFocused();
});
