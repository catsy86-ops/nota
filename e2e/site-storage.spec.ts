import { test, expect } from "@playwright/test";

// P3.1: miejsce zajęte przez budowę — w karcie i w Ustawieniach (Kopia i dane).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

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
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("miejsce budowy: linijka w karcie i lista w Ustawieniach", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  await card.getByTestId("site-docs").getByLabel("Wybierz plany i dokumenty").setInputFiles({ name: "Rzut.png", mimeType: "image/png", buffer: PNG });
  await expect(card.getByTestId("site-storage")).toHaveText(/Zdjęcia, nagrania i dokumenty: \d+(,\d+)? (B|KB)/);
  // Karta jest modalna — dopiero po jej zamknięciu reszta strony jest dostępna.
  await expect(async () => { await page.keyboard.press("Escape"); await expect(card).toBeHidden({ timeout: 1000 }); }).toPass({ timeout: 10000 });

  // Skrót zamiast kliknięcia: w Pracy dymki (np. „Raport dnia gotowy”) potrafią zasłonić pasek boczny.
  await page.keyboard.press("Control+Comma");
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  const section = page.getByTestId("site-storage-settings");
  await section.getByRole("button", { name: "Policz miejsce" }).click();
  await expect(section).toContainText("Razem:");
  await expect(section).toContainText("Lipowa 5");
});
