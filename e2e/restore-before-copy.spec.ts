import { test, expect, type Page } from "@playwright/test";

// Z-18.3 (P5, P6 audytu 2): okno mówi, co zastąpi, a co uzupełni; bez OPFS pyta, czy plik sprzed przywrócenia się zapisał.

async function openRestore(page: Page) {
  await page.goto("/");
  await page.getByText("Zapisz notatkę...").click();
  const title = `Przed ${Date.now()}`;
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toBeVisible();
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Dane" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Pobierz pełną kopię teraz" }).click(),
  ]);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Przywróć z pliku kopii" }).click(),
  ]);
  await chooser.setFiles((await download.path())!);
  return title;
}

test("okno wymienia zastąpione i uzupełnione części; kopia w OPFS przed przywróceniem", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  const title = await openRestore(page);
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByTestId("restore-replaced")).toContainText("notatki, foldery, etykiety");
  await dialog.getByRole("button", { name: "Przywróć kopię" }).click();
  await expect(page.getByText(/Przywrócono kopię/)).toBeVisible();
  await page.waitForLoadState("load");
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toBeVisible();
  const files = await page.evaluate(async () => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("kopie-przed-przywroceniem");
    const names: string[] = [];
    for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
    return names;
  });
  expect(files.some((n) => n.startsWith("przed-przywroceniem-"))).toBe(true);
});

test("bez OPFS: pytanie „Czy plik się zapisał?”, „Nie” wstrzymuje przywracanie", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    Object.defineProperty(navigator.storage, "getDirectory", { value: () => Promise.reject(new Error("brak")) });
  });
  await openRestore(page);
  await page.getByRole("alertdialog").getByRole("button", { name: "Przywróć kopię" }).click();
  const ask = page.getByRole("alertdialog").filter({ hasText: "Czy plik się zapisał?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Nie, wstrzymaj" }).click();
  await expect(page.getByText(/Przywrócono kopię/)).toHaveCount(0);
});
