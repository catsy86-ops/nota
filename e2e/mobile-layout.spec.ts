import { test, expect } from "@playwright/test";

// 5.2 (plan mobile): układ telefonu bez poziomego przewijania na żadnej trasie,
// pasek zbiorczy w całości na ekranie 390 px, „wstecz” zamyka edytor notatki.

test.use({ isMobile: true, hasTouch: true });

const ROUTES = ["/", "/dzis", "/tydzien", "/przypomnienia", "/kalendarz", "/grafik", "/praca", "/archiwum", "/kosz"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

for (const width of [320, 390]) {
  test(`${width} px: żadna trasa nie przewija się w bok @mobile`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const route of ROUTES) {
      await page.goto(route);
      await expect(page.locator("main").first()).toBeVisible();
      // Leniwie ładowane widoki (Kalendarz, Grafik, Praca) — chwila na wyrenderowanie treści.
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const wide = Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.right <= doc.clientWidth + 1) return false;
            // Elementy wewnątrz przewijanego w bok kontenera (paski pigułek) są w porządku.
            for (let p = el.parentElement; p; p = p.parentElement) {
              const ox = getComputedStyle(p).overflowX;
              if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return false;
            }
            return true;
          })
          .slice(0, 3)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
        return { page: doc.scrollWidth - doc.clientWidth, wide };
      });
      expect(overflow.page, `${route}: strona szersza niż ekran (${overflow.wide.join(" | ")})`).toBeLessThanOrEqual(0);
    }
  });
}

test("pasek zbiorczy mieści się w 390 px bez przewijania @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Do paska");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.locator("[data-note-idx]").filter({ hasText: "Do paska" }).getByRole("button", { name: "Zaznacz notatkę" }).click();
  const clear = page.getByRole("button", { name: "Wyczyść zaznaczenie" });
  await expect(clear).toBeVisible();
  const bar = await clear.evaluate((el) => {
    const box = el.parentElement!;
    const r = box.getBoundingClientRect();
    return { left: r.left, right: r.right, scroll: box.scrollWidth - box.clientWidth };
  });
  expect(bar.left).toBeGreaterThanOrEqual(0);
  expect(bar.right).toBeLessThanOrEqual(390);
  expect(bar.scroll, "akcje paska nie mieszczą się — trzeba przewijać").toBeLessThanOrEqual(0);
});

test("„wstecz” zamyka edytor notatki i zostaje w Notatkach @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Wstecz z edytora");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await page.getByRole("heading", { name: "Wstecz z edytora" }).click();
  const editor = page.getByRole("dialog", { name: /Edycja notatki/ });
  await expect(editor).toBeVisible();
  await page.goBack();
  await expect(editor).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Wstecz z edytora" })).toBeVisible();
});
