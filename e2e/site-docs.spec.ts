import { test, expect, type Page } from "@playwright/test";

// Plany i dokumenty budowy (H3): zdjęcie rzutu i PDF w karcie, powiększenie, otwarcie, usunięcie z „Cofnij”, po przeładowaniu.

// Najmniejszy poprawny PNG (1×1) i PDF — wystarczą do zapisu, miniatury i pobrania.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

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

test("plany i dokumenty: zdjęcie i PDF w karcie budowy, powiększenie, otwarcie, usunięcie z Cofnij", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const docs = page.getByTestId("site-docs");
  await expect(docs).toContainText("Rzut, projekt, zdjęcie tablicy");

  await docs.getByLabel("Wybierz plany i dokumenty").setInputFiles([
    { name: "Rzut parteru.png", mimeType: "image/png", buffer: PNG },
    { name: "Projekt wod-kan.pdf", mimeType: "application/pdf", buffer: PDF },
  ]);
  await expect(page.getByText("Dodano plików: 2")).toBeVisible();
  await expect(docs.getByRole("button", { name: "Powiększ: Rzut parteru" })).toBeVisible();
  await expect(docs).toContainText("Projekt wod-kan");

  await docs.getByRole("button", { name: "Powiększ: Rzut parteru" }).click();
  await expect(page.getByTestId("site-doc-zoom").getByRole("img", { name: "Rzut parteru" })).toBeVisible();
  await page.getByRole("button", { name: "100%" }).click();
  await expect(page.getByRole("button", { name: "Dopasuj" })).toBeVisible();
  await page.keyboard.press("Escape");

  const download = page.waitForEvent("download");
  await docs.getByRole("button", { name: "Otwórz: Projekt wod-kan" }).click();
  expect((await download).suggestedFilename()).toBe("Projekt wod-kan.pdf");

  await docs.getByRole("button", { name: "Usuń: Projekt wod-kan" }).click();
  await expect(docs).not.toContainText("Projekt wod-kan");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(docs).toContainText("Projekt wod-kan");

  await reloadWhenSaved(page);
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const after = page.getByTestId("site-docs");
  await expect(after.getByRole("button", { name: "Powiększ: Rzut parteru" })).toBeVisible();
  await expect(after.getByRole("button", { name: "Otwórz: Projekt wod-kan" })).toBeVisible();
});

test("inny typ pliku jest pomijany z komunikatem", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await page.getByTestId("site-docs").getByLabel("Wybierz plany i dokumenty").setInputFiles([
    { name: "notatki.txt", mimeType: "text/plain", buffer: Buffer.from("x") },
  ]);
  await expect(page.getByText("Pominięte: notatki.txt (tylko zdjęcia i PDF).")).toBeVisible();
});

test("plany i dokumenty na dotyku: przycisk usunięcia ma co najmniej 44 px @mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("iphone"), "pomiar dotyku tylko na telefonie");
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const docs = page.getByTestId("site-docs");
  await docs.getByLabel("Wybierz plany i dokumenty").setInputFiles([{ name: "Rzut.png", mimeType: "image/png", buffer: PNG }]);
  const remove = docs.getByRole("button", { name: /^Usuń: Rzut/ });
  await expect(remove).toBeVisible();
  const box = await remove.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
