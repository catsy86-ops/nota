import { test, expect } from "@playwright/test";

// P2.2: zdjęcia przed zakryciem. W karcie budowy, pod etapem „Zakrycie instalacji”, jest licznik i „Zrób zdjęcia”.
// Zdjęcie staje się wpisem tej budowy przypiętym do etapu zakrycia.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 6, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 10, 5, 9).getTime(), kind: "ok", topic: null, text: "Montaż", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("karta budowy: „Zrób zdjęcia” przed zakryciem dodaje zdjęcie do etapu i podnosi licznik", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");

  const counter = card.getByTestId("cover-photos");
  await expect(counter).toContainText("Zdjęcia przed zakryciem: 0");

  const chooser = page.waitForEvent("filechooser");
  await counter.getByRole("button", { name: "Zrób zdjęcia przed zakryciem: Lipowa 5" }).click();
  await (await chooser).setFiles({ name: "zakrycie.png", mimeType: "image/png", buffer: PNG });

  await expect(page.getByText("Zdjęcie przed zakryciem: Lipowa 5")).toBeVisible();
  await expect(counter).toContainText("Zdjęcia przed zakryciem: 1");
});
