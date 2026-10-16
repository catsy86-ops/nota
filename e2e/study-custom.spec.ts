import { test, expect, type Page } from "@playwright/test";

/** Nauka zapisuje się do IndexedDB (Yjs) asynchronicznie — przeładowanie dopiero po „Zapisano”. */
async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
});

test("własny punkt listy trafia do tematu, przeżywa przeładowanie i znika po „Cofnij”", async ({ page }) => {
  await page.getByRole("tab", { name: "Lista" }).click();
  await page.getByText("Własne punkty").click();
  await page.getByLabel("Treść punktu").fill("Sprawdzić zawór przed płukaniem");
  await page.getByRole("button", { name: "Dodaj punkt" }).click();

  const list = page.getByTestId("custom-checklist");
  await expect(list.getByText("Sprawdzić zawór przed płukaniem")).toBeVisible();
  await expect(page.getByText("własny", { exact: true })).toBeVisible();

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Lista" }).click();
  await page.getByText("Własne punkty").click();
  await expect(page.getByTestId("custom-checklist").getByText("Sprawdzić zawór przed płukaniem")).toBeVisible();

  await page.getByRole("button", { name: "Usuń punkt: Sprawdzić zawór przed płukaniem" }).click();
  await expect(page.getByText("Usunięto „Sprawdzić zawór przed płukaniem”")).toBeVisible();
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByTestId("custom-checklist").getByText("Sprawdzić zawór przed płukaniem")).toBeVisible();
});

test("własne pytanie zapisuje się, przeżywa przeładowanie i jest w liczniku quizu", async ({ page }) => {
  await page.getByTestId("open-custom-questions").click();
  const dialog = page.getByTestId("custom-questions");
  await expect(dialog).toBeVisible();

  // Pusty formularz nie zapisuje się — komunikat przy formularzu.
  await dialog.getByRole("button", { name: "Dodaj pytanie" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Wpisz treść pytania.");

  await dialog.getByLabel("Pytanie").fill("Ile zaworów na pionie?");
  await dialog.getByLabel("Poprawna odpowiedź").fill("Jeden");
  await dialog.getByLabel("Błędna odpowiedź 1").fill("Dwa");
  await dialog.getByLabel("Błędna odpowiedź 2").fill("Trzy");
  await dialog.getByLabel("Błędna odpowiedź 3").fill("Żaden");
  await dialog.getByRole("button", { name: "Dodaj pytanie" }).click();
  await expect(page.getByText("Dodano pytanie do quizu")).toBeVisible();
  await expect(dialog.getByText("Ile zaworów na pionie?")).toBeVisible();
  await page.keyboard.press("Escape");

  await reloadWhenSaved(page);
  await expect(page.getByTestId("open-custom-questions")).toContainText("(1)");
  await page.getByTestId("open-custom-questions").click();
  await expect(page.getByTestId("custom-questions").getByText("Ile zaworów na pionie?")).toBeVisible();
  await page.keyboard.press("Escape");

  // Runda startuje z puli, do której trafiło własne pytanie.
  await page.getByRole("tab", { name: "Quiz" }).click();
  await page.getByRole("button", { name: "Zacznij rundę" }).click();
  await expect(page.getByText(/Pytanie 1 z \d+/)).toBeVisible();
});
