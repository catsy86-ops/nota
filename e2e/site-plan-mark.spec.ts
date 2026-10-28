import { test, expect } from "@playwright/test";

// P2.7 Zaznaczanie na planie: rysunek na planie budowy zapisuje się jako NOWY dokument; oryginał zostaje.
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

test("zaznaczony plan jest nowym dokumentem, a oryginał zostaje", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const docs = page.getByTestId("site-docs");
  await docs.getByLabel("Wybierz plany i dokumenty").setInputFiles({ name: "Rzut.png", mimeType: "image/png", buffer: PNG });
  await expect(docs.getByRole("button", { name: "Powiększ: Rzut", exact: true })).toBeVisible();

  await docs.getByRole("button", { name: "Zaznacz na planie: Rzut" }).click();
  // Płótno zmienia rozmiar, gdy wczyta się obraz planu — rysujemy dopiero, gdy pozycja się ustali.
  const canvas = page.locator("canvas.cursor-crosshair");
  await expect(canvas).toBeVisible();
  // Animacja otwarcia i wczytanie planu zmieniają położenie — czekamy na chwilę spokoju.
  await page.waitForTimeout(800);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 160, box.y + 90, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Zapisz rysunek" }).click();

  await expect(page.getByText("Dodano „Rzut (zaznaczony)”")).toBeVisible();
  await expect(docs.getByRole("button", { name: "Powiększ: Rzut", exact: true })).toHaveCount(1);
  await expect(docs.getByRole("button", { name: "Powiększ: Rzut (zaznaczony)" })).toBeVisible();
});
