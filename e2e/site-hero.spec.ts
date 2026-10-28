import { test, expect } from "@playwright/test";

// P5.1: karta budowy z okładką ze zdjęcia (nazwa i adres na niej) i etapami jako linia kropek.
// Mały, ale kolorowy PNG 8×4 — okładka widoczna na zrzucie.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAIAAAA8r+mnAAAAHklEQVR42mNkYPj/n4EBBTAyMDIyMjIwMDIwYAAAbP0F/3kFDH8AAAAASUVORK5CYII=", "base64");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: Date.now() - 3600_000, kind: "ok", topic: null, text: "Piony", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

test("karta: bez zdjęcia zwykły nagłówek; z planem okładka z nazwą, a etapy jako kropki", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await expect(card.getByTestId("site-cover")).toHaveCount(0);

  await card.getByTestId("site-stages").getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ }).click();
  await expect(card.getByTestId("site-stage-dots")).toHaveAttribute("aria-label", /Etapy: 1 z 7/);

  await card.getByTestId("site-docs").getByLabel("Wybierz plany i dokumenty").setInputFiles({ name: "Rzut.png", mimeType: "image/png", buffer: PNG });
  const cover = card.getByTestId("site-cover");
  await expect(cover).toBeVisible();
  await expect(cover.getByRole("heading", { name: "Lipowa 5" })).toBeVisible();
  await expect(cover.getByTestId("site-stage-dots")).toBeVisible();
  // Bez poziomego przewijania na telefonie.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await card.evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: process.env.HERO_SHOT ?? "test-results/site-hero-390.png" });
});
