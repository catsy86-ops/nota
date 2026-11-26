import { test, expect } from "@playwright/test";
import { addNote } from "./helpers";

// Q5.3: prawy przycisk otwiera to samo menu „⋯” co przycisk — wpis dziennika, wiersz paska bocznego, kafel notatki.

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone") || testInfo.project.name.includes("pixel"), "prawy przycisk myszy — komputer");
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("wpis dziennika: prawy przycisk otwiera menu „Opcje wpisu”", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "p", at: new Date(2026, 9, 22, 9, 5).getTime(), kind: "problem", topic: null, text: "Cieknie złączka", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.goto("/praca");
  const entry = page.locator("[data-journal-entry]").filter({ hasText: "Cieknie złączka" });
  await entry.getByText("Cieknie złączka").click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Edytuj wpis" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Edytuj wpis" })).toHaveCount(0);
});

test("folder w pasku bocznym: prawy przycisk otwiera jego menu", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await page.keyboard.type("Budowy");
  await page.keyboard.press("Enter");
  const row = page.getByRole("button", { name: /^Budowy/ }).first();
  await expect(row).toBeVisible();
  await row.click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
});

test("kafel notatki: prawy przycisk rozwija „Więcej opcji”, a w polu tekstowym zostaje menu przeglądarki", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await addNote(page, "Kafel z menu", "treść");
  const card = page.locator("[data-note-id-wrap]").filter({ hasText: "Kafel z menu" }).first();
  await card.getByText("Kafel z menu").click({ button: "right" });
  await expect(card.getByRole("button", { name: "Mniej opcji" })).toHaveAttribute("aria-expanded", "true");
  // Wyszukiwarka to pole tekstowe — tam nie przejmujemy menu.
  const prevented = await page.getByRole("searchbox").evaluate((el) => {
    const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
});
