import { test, expect } from "@playwright/test";

// P2.3 Usterki w karcie budowy: odpowiedzialny, termin (z czerwienią po terminie) i zdjęcie po naprawie.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "p", at: new Date(2026, 9, 14, 9).getTime(), kind: "problem", topic: null, text: "Nieszczelna rewizja w łazience", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("usterka: odpowiedzialny i termin zapisują się, po terminie jest czerwony, zdjęcie po naprawie się liczy", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  const faults = card.getByTestId("site-faults");
  await expect(faults).toContainText("Nieszczelna rewizja w łazience");
  await expect(faults).toContainText("bez terminu");

  await faults.getByLabel("Odpowiedzialny").fill("Marek");
  await faults.getByLabel("Odpowiedzialny").blur();
  await faults.getByLabel("Termin").fill("2026-10-20");
  await expect(faults).toContainText("termin za 6 dni");

  // Po terminie: status pokazuje dni po terminie.
  await faults.getByLabel("Termin").fill("2026-10-10");
  await expect(faults).toContainText("po terminie 4 dni");

  await faults.locator('input[type="file"]').setInputFiles({ name: "po.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(faults).toContainText("po naprawie: 1");

  // Po przeładowaniu dane zostają.
  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const again = page.getByTestId("site-card").getByTestId("site-faults");
  await expect(again.getByLabel("Odpowiedzialny")).toHaveValue("Marek");
  await expect(again).toContainText("po naprawie: 1");
});
