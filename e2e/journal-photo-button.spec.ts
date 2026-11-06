import { test, expect } from "@playwright/test";

// P2.1: pływający przycisk „Zdjęcie” na osi dziennika. Z wybraną budową zdjęcie od razu staje się wpisem
// tej budowy; bez budowy otwiera się zwykły arkusz wpisu.

// Najmniejszy poprawny PNG (1×1), żeby nie trzymać pliku w repozytorium.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

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
});

test("bez wybranej budowy przycisk „Zdjęcie” otwiera nowy wpis", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: "Zdjęcie do nowego wpisu" }).click();
  await expect(page.getByTestId("journal-entry-sheet")).toBeVisible();
});

test("z wybraną budową zdjęcie z aparatu staje się wpisem tej budowy", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("group", { name: "Budowa" }).getByRole("button", { name: /Lipowa 5/ }).click();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Zdjęcie do wpisu: Lipowa 5" }).click();
  await (await chooser).setFiles({ name: "montaz.png", mimeType: "image/png", buffer: PNG });

  await expect(page.getByText("Dodano zdjęcie do budowy „Lipowa 5”")).toBeVisible();
});
