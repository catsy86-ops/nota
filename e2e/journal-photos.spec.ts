import { test, expect, type Page } from "@playwright/test";

// P4: zdjęcia „przed zakryciem” — podpis wtopiony w zdjęcie (z datą wpisu),
// limit 5 zdjęć na wpis, galeria wszystkich zdjęć wpisu w powiększeniu.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

/** Różne PNG (inny kolor = inny hash w magazynie zdjęć) narysowane w przeglądarce. */
async function pngs(page: Page, n: number) {
  const data = await page.evaluate((count) => Array.from({ length: count }, (_, i) => {
    const c = document.createElement("canvas");
    c.width = 160; c.height = 120;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = `hsl(${i * 60}, 70%, 50%)`;
    ctx.fillRect(0, 0, 160, 120);
    return c.toDataURL("image/png").split(",")[1];
  }), n);
  return data.map((b64, i) => ({ name: `budowa-${i}.png`, mimeType: "image/png", buffer: Buffer.from(b64, "base64") }));
}

test("zdjęcia wpisu: podpis wtopiony w zdjęcie, limit 5, galeria w powiększeniu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Pion przed zakryciem");

  const files = await pngs(page, 6);
  await sheet.getByTestId("journal-photo-input").setInputFiles(files);
  await expect(page.getByText("Wpis mieści maksymalnie 5 zdjęć")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(5);

  // Podpis: zdjęcie podmienia się na nowe (inny klucz w magazynie), liczba zdjęć bez zmian.
  const firstImg = sheet.getByRole("list", { name: "Zdjęcia we wpisie" }).locator("img").first();
  await expect(firstImg).toHaveAttribute("src", /.+/);
  const before = await firstImg.getAttribute("src");
  await sheet.getByRole("button", { name: "Podpis na zdjęciu" }).first().click();
  const form = sheet.getByRole("form", { name: "Podpis na zdjęciu" });
  await form.getByRole("button", { name: "Przed zakryciem" }).click();
  await expect(form.getByRole("textbox")).toHaveValue("Przed zakryciem");
  await form.getByRole("textbox").fill("Łazienka, pion 58 cm");
  await form.getByRole("button", { name: "Zapisz podpis" }).click();
  await expect(form).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(5);
  // P-1: podpis jest danymi wpisu, zdjęcie w magazynie zostaje bez zmian (wypalenie dopiero przy eksporcie).
  await expect(firstImg).toHaveAttribute("src", before!);
  await expect(sheet.getByRole("list", { name: "Podpisy zdjęć" })).toContainText("Łazienka, pion 58 cm");

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);

  // Galeria: wszystkie zdjęcia wpisu, strzałki i przyciski.
  await page.getByRole("button", { name: "Powiększ zdjęcie" }).first().click();
  const zoom = page.getByTestId("journal-photo-zoom");
  await expect(zoom.getByTestId("journal-photo-counter")).toHaveText("1/5");
  await zoom.getByRole("button", { name: "Następne zdjęcie" }).click();
  await expect(zoom.getByTestId("journal-photo-counter")).toHaveText("2/5");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(zoom.getByTestId("journal-photo-counter")).toHaveText("5/5");
});
