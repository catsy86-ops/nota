import { test, expect, type Page } from "@playwright/test";
import * as Y from "yjs";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashImage } from "../src/lib/imageHash";

// 1×1 px PNG.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_DATA_URL = `data:image/png;base64,${PNG_B64}`;

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
}

async function openDataTab(page: Page) {
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Dane" }).click();
}

async function addNoteWithImage(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByTitle("Dodaj obrazek").click(),
  ]);
  await chooser.setFiles({ name: "kropka.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(1); // podgląd w pasku dodawania
  await page.getByRole("button", { name: "Zamknij" }).click();
}

const cardImage = (page: Page, title: string) =>
  page.locator("[data-note-id]").filter({ hasText: title }).locator('img[src^="blob:"]');

async function mergeSyncFile(page: Page, file: string) {
  await openDataTab(page);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Scal z pliku" }).click(),
  ]);
  await chooser.setFiles(file);
  await expect(page.getByText(/^Scalono/)).toBeVisible();
  await page.keyboard.press("Escape");
}

test("obraz przeżywa przeładowanie i jedzie plikiem synchronizacji na drugie urządzenie", async ({ browser }) => {
  const title = `Z obrazkiem ${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  await open(a);
  await addNoteWithImage(a, title);
  await expect(cardImage(a, title)).toHaveCount(1);

  await a.reload();
  await expect(cardImage(a, title)).toHaveCount(1);

  await openDataTab(a);
  const [download] = await Promise.all([
    a.waitForEvent("download"),
    a.getByRole("button", { name: "Zapisz plik synchronizacji" }).click(),
  ]);
  const file = (await download.path())!;

  const b = await (await browser.newContext()).newPage();
  await open(b);
  await mergeSyncFile(b, file);
  await expect(cardImage(b, title)).toHaveCount(1);
  expect(await cardImage(b, title).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);
});

test("pełny backup niesie bajty obrazu i odtwarza je na czystym urządzeniu", async ({ browser }) => {
  const title = `Backup z obrazkiem ${Date.now()}`;
  const a = await (await browser.newContext()).newPage();
  await open(a);
  await addNoteWithImage(a, title);
  await openDataTab(a);
  const [download] = await Promise.all([
    a.waitForEvent("download"),
    a.getByRole("button", { name: "Pobierz pełny backup teraz" }).click(),
  ]);
  const file = (await download.path())!;

  const b = await (await browser.newContext()).newPage();
  await open(b);
  await openDataTab(b);
  const [chooser] = await Promise.all([
    b.waitForEvent("filechooser"),
    b.getByRole("button", { name: "Przywróć z pliku backupu" }).click(),
  ]);
  await chooser.setFiles(file);
  await b.getByRole("alertdialog").getByRole("button", { name: "Przywróć backup" }).click();
  await expect(b.getByText(/Backup przywrócony/)).toBeVisible();
  await b.waitForLoadState("load");
  await expect(cardImage(b, title)).toHaveCount(1);
});

test("migracja: obraz ze starego klucza kaczy.images.v2 trafia do nowego store'u, a manifest FNV dostaje SHA-256", async ({ page }) => {
  const title = `Stary obraz ${Date.now()}`;
  const noteId = `stara-${Date.now()}`;

  // Notatka z manifestem w starym formacie (hash FNV) — przychodzi plikiem sync v1 bez bajtów.
  const doc = new Y.Doc();
  const y = new Y.Map<unknown>();
  doc.getMap("notes").set(noteId, y);
  y.set("title", title);
  y.set("content", new Y.Text());
  y.set("imageHashes", [hashImage(PNG_DATA_URL)]);
  y.set("createdAt", Date.now());
  y.set("updatedAt", Date.now());
  const file = join(tmpdir(), `kaczy-sync-v1-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({
    format: "kaczy-sync", version: 1, exportedAt: Date.now(),
    update: Buffer.from(Y.encodeStateAsUpdateV2(doc)).toString("base64"), images: {},
  }));

  await open(page);
  await mergeSyncFile(page, file);
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await expect(card.getByRole("img", { name: "Obraz jeszcze nie dotarł na to urządzenie" })).toBeVisible();

  // Bajty leżą pod starym kluczem per notatka — tak jak przed tą wersją aplikacji.
  await page.evaluate(([id, dataUrl]) => new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("keyval-store");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put([dataUrl], `kaczy.images.v2:${id}`);
      tx.oncomplete = () => { req.result.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), [noteId, PNG_DATA_URL]);

  await page.reload();
  await expect(cardImage(page, title)).toHaveCount(1);
  const oldKeyLeft = await page.evaluate((id) => new Promise((resolve) => {
    const req = indexedDB.open("keyval-store");
    req.onsuccess = () => {
      const get = req.result.transaction("keyval").objectStore("keyval").get(`kaczy.images.v2:${id}`);
      get.onsuccess = () => { req.result.close(); resolve(get.result !== undefined); };
    };
  }), noteId);
  expect(oldKeyLeft).toBe(false);
});
