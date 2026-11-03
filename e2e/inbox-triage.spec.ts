import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/skrzynka");
});

async function capture(page: import("@playwright/test").Page, text: string) {
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(text);
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
}

test("skrzynka: porządkowanie — archiwizacja, cofnięcie, kosz i zostawienie", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Pierwsza ${stamp}`);
  await capture(page, `Druga ${stamp}`);

  await page.getByRole("button", { name: /Porządkuj skrzynkę \(2\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Archiwizuj" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Cofnij" }).click();
  await expect(dialog).toContainText("1 z 2");

  await dialog.getByRole("button", { name: "Kosz" }).click();
  await expect(dialog).toContainText("2 z 2");

  await dialog.getByRole("button", { name: "Zostaw w skrzynce" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona.");
});

test("skrzynka: „Jutro” odkłada notatkę poza Skrzynkę, „Cofnij” ją przywraca (S-1)", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Odłożona ${stamp}`);

  await page.getByRole("button", { name: /Porządkuj skrzynkę \(1\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await dialog.getByRole("button", { name: "Jutro" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona");

  await dialog.getByRole("button", { name: "Cofnij ostatnią akcję" }).click();
  await expect(dialog).toContainText("1 z 1");
});

test("skrzynka: pusty stan „Zapisz pomysł” daje kursor w polu; „Otwórz notatkę” z porządkowania (4.5, 3.2)", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Nowa notatka" })).toHaveCount(0);
  await page.getByRole("button", { name: "Zapisz pomysł" }).click();
  await expect(page.getByLabel("Przechwyć do skrzynki")).toBeFocused();

  const stamp = Date.now();
  await capture(page, `Pomysł ${stamp}`);
  await page.getByRole("button", { name: /Porządkuj skrzynkę \(1\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await dialog.getByRole("button", { name: "Otwórz notatkę" }).click();
  await expect(dialog).toBeHidden();
  // Edytor otwiera się w miejscu kafla (pole tytułu w karcie notatki).
  await expect(page.getByRole("article", { name: `Pomysł ${stamp}` }).getByRole("textbox", { name: "Tytuł" })).toHaveValue(`Pomysł ${stamp}`);
});

test("skrzynka 2.1: fraza #etykieta zapisuje z etykietą i mówi, dokąd trafiła notatka; chip da się zignorować", async ({ page }) => {
  const stamp = Date.now();
  const input = page.getByLabel("Przechwyć do skrzynki");
  await input.fill(`Kolana ${stamp} #hurtownia jutro 9:00`);
  const chips = page.getByRole("group", { name: "Rozpoznane w tekście" });
  await expect(chips).toContainText("#hurtownia");
  await expect(chips).toContainText("Przypomnienie");
  await input.press("Enter");
  await expect(page.getByText(/Zapisano w #hurtownia · jutro/)).toBeVisible();
  // Z etykietą notatka wychodzi ze Skrzynki od razu.
  await expect(page.getByRole("main").getByText(`Kolana ${stamp}`)).toHaveCount(0);

  await input.fill(`Rury ${stamp} #hurtownia`);
  await page.getByRole("button", { name: "Zignoruj: Etykieta hurtownia" }).click();
  await input.press("Enter");
  await expect(page.getByText("Zapisano w skrzynce")).toBeVisible();
  await expect(page.getByRole("main").getByText(`Rury ${stamp} #hurtownia`)).toBeVisible();
});

test("skrzynka 2.5: upuszczony obraz zapisuje notatkę ze zdjęciem i tytułem z pola", async ({ page }) => {
  const stamp = Date.now();
  await page.getByLabel("Przechwyć do skrzynki").fill(`Kotłownia ${stamp}`);
  await page.evaluate(async () => {
    // Prawdziwy PNG 8×8 z canvas — `prepareImage` musi go zdekodować.
    const c = document.createElement("canvas");
    c.width = 8; c.height = 8;
    c.getContext("2d")!.fillRect(0, 0, 8, 8);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], "kotlownia.png", { type: "image/png" }));
    const form = document.querySelector("[data-inbox-capture]")!.closest("form")!;
    form.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
    form.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await expect(page.getByText("Zapisano w skrzynce z plikiem")).toBeVisible();
  await expect(page.getByLabel("Przechwyć do skrzynki")).toHaveValue("");
  const card = page.locator("[data-note-id]").filter({ hasText: `Kotłownia ${stamp}` });
  await expect(card.locator("img").first()).toBeVisible();
});

test("skrzynka 3.1: filtr chipów — Enter wybiera pierwszy, „Nowa etykieta” tworzy i nadaje", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Klej ${stamp}`);
  await capture(page, `Rury ${stamp}`);
  await page.getByRole("button", { name: /Porządkuj skrzynkę \(2\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });

  const filter = dialog.getByLabel("Szukaj folderu lub etykiety");
  await filter.fill("#hurt");
  await expect(dialog.getByRole("button", { name: "Nowa etykieta #hurt" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Nowy folder „hurt”" })).toBeVisible();
  await dialog.getByRole("button", { name: "Nowa etykieta #hurt" }).click();
  await expect(dialog).toContainText("2 z 2");
  // Filtr czyści się przy następnej notatce, a nowa etykieta jest już chipem.
  await expect(filter).toHaveValue("");
  await filter.fill("HUR");
  await filter.press("Enter");
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona.");
});

test("skrzynka 3.4: „Przypomnij…” → „Jutro 9:00” ustawia termin, notatka zostaje w Skrzynce", async ({ page }) => {
  const stamp = Date.now();
  await capture(page, `Oddzwonić ${stamp}`);
  await page.getByRole("button", { name: /Porządkuj skrzynkę \(1\)/ }).click();
  const dialog = page.getByRole("dialog", { name: "Porządkowanie skrzynki" });
  await dialog.getByRole("button", { name: "Przypomnij…" }).click();
  await dialog.getByRole("group", { name: "Termin przypomnienia" }).getByRole("button", { name: "Jutro 9:00" }).click();
  await expect(dialog).toContainText("Gotowe — skrzynka opróżniona.");
  await page.keyboard.press("Escape");
  const card = page.locator("[data-note-id]").filter({ hasText: `Oddzwonić ${stamp}` });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(/jutro|9:00/i);
});
