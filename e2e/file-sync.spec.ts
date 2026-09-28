import { test, expect, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
}

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

async function openDataTab(page: Page) {
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Dane" }).click();
}

test("plik synchronizacji scala notatki dwóch urządzeń bez usuwania", async ({ browser }) => {
  const fromA = `z-urzadzenia-A-${Date.now()}`;
  const fromB = `z-urzadzenia-B-${Date.now()}`;

  const a = await (await browser.newContext()).newPage();
  await open(a);
  await addNote(a, fromA);
  await openDataTab(a);
  const [download] = await Promise.all([
    a.waitForEvent("download"),
    a.getByRole("button", { name: "Zapisz plik synchronizacji" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^kaczy-sync-.*\.json$/);
  const file = (await download.path())!;

  const b = await (await browser.newContext()).newPage();
  await open(b);
  await addNote(b, fromB);
  await openDataTab(b);
  const [chooser] = await Promise.all([
    b.waitForEvent("filechooser"),
    b.getByRole("button", { name: "Scal z pliku" }).click(),
  ]);
  await chooser.setFiles(file);
  await expect(b.getByText("Scalono — 1 nowa notatka")).toBeVisible();
  await b.keyboard.press("Escape");

  await expect(b.getByText(fromA)).toBeVisible();
  await expect(b.getByText(fromB)).toBeVisible();
});
