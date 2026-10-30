import { test, expect } from "@playwright/test";

// Menu „⋯” przy wpisie dziennika (2026-10-30): edycja w arkuszu, rozwiązanie problemu, kopiowanie, usunięcie z „Cofnij”.

test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "p", at: new Date(2026, 9, 22, 9, 5).getTime(), kind: "problem", topic: null, text: "Cieknie złączka", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.goto("/praca");
});

test("⋯ przy wpisie: rozwiązany, kopiuj, edytuj, usuń i cofnij @mobile", async ({ page }) => {
  const entry = page.locator("[data-journal-entry]").filter({ hasText: "Cieknie złączka" });
  const menu = entry.getByRole("button", { name: "Opcje wpisu" });

  await menu.click();
  await page.getByRole("menuitem", { name: "Oznacz jako rozwiązany" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveAttribute("data-resolved", "true");
  await page.keyboard.press("Escape"); // pole „Jak rozwiązane?” — pomijamy

  await menu.click();
  await page.getByRole("menuitem", { name: "Kopiuj tekst" }).click();
  await expect(page.getByText("Skopiowano wpis")).toBeVisible();
  // Schowek Windows zamienia \n na \r\n.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe("Problem (rozwiązany) · Lipowa 5 · 22.10.2026, 09:05\nCieknie złączka");

  await menu.click();
  await page.getByRole("menuitem", { name: "Edytuj wpis" }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("heading", { name: "Edytuj wpis" })).toBeVisible();
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("Cieknie złączka");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await menu.click();
  await page.getByRole("menuitem", { name: "Usuń wpis" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.locator("[data-journal-entry]")).toHaveCount(1);
});
