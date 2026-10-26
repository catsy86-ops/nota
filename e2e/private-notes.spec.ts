import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const SECRET = "ZNACZNIKSEKRET8841";
const TITLE = "Zebranie jutrzejsze";
const PASSWORD = "stol-krzeslo-lampa-2026";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.locator("[data-note-id]").filter({ hasText: title })).toBeVisible();
}

function card(page: Page, text: string) {
  return page.locator("[data-note-id]").filter({ hasText: text });
}

async function openMenu(page: Page, text: string) {
  const c = card(page, text);
  await c.hover();
  await c.getByRole("button", { name: "Więcej opcji" }).click();
  return c;
}

/** Zakłada skarbiec i blokuje notatkę (pierwsze użycie). */
async function setUpVaultAndLock(page: Page) {
  const c = await openMenu(page, TITLE);
  await c.getByRole("button", { name: "Zablokuj (notatka prywatna)" }).click();

  const dialog = page.getByRole("dialog", { name: "Ustaw hasło skarbca" });
  await expect(dialog).toBeVisible();
  // Wyraźne ostrzeżenie o braku odzyskiwania.
  await expect(dialog).toContainText("Zapomnianego hasła nie da się odzyskać");
  await dialog.getByLabel("Hasło skarbca").fill(PASSWORD);
  await dialog.getByLabel("Powtórz hasło").fill(PASSWORD);
  await dialog.getByLabel("Rozumiem, że zapomnianego hasła nie da się odzyskać.").check();
  await dialog.getByRole("button", { name: "Ustaw hasło" }).click();

  // Kod awaryjny pokazywany raz.
  const recovery = page.getByRole("dialog", { name: "Zapisz kod awaryjny" });
  await expect(recovery.getByTestId("recovery-code")).toHaveText(/^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/);
  await recovery.getByLabel("Zapisałem kod w bezpiecznym miejscu.").check();
  await recovery.getByRole("button", { name: "Gotowe" }).click();
  await expect(page.getByText("Notatka zablokowana")).toBeVisible();
}

async function lockNowFromPalette(page: Page) {
  await page.keyboard.press("Control+k");
  await page.getByRole("option", { name: /Zablokuj prywatne notatki teraz/ }).click();
  await expect(page.locator("[data-private-tile]")).toBeVisible();
}

async function unlockViaTile(page: Page, password: string) {
  await page.locator("[data-private-tile]").click();
  const dialog = page.getByRole("dialog", { name: "Odblokuj prywatne notatki" });
  await dialog.getByLabel("Hasło skarbca").fill(password);
  await dialog.getByRole("button", { name: "Odblokuj" }).click();
  return dialog;
}

/** Surowe rekordy IndexedDB dokumentu (dziennik aktualizacji Yjs) jako tekst. */
async function dumpDocIdb(page: Page): Promise<string> {
  return page.evaluate(() => new Promise<string>((resolve, reject) => {
    const open = indexedDB.open("kaczy-yjs-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = db.transaction("updates").objectStore("updates").getAll();
      req.onsuccess = () => {
        const dec = new TextDecoder("latin1");
        const out = (req.result as Uint8Array[]).map((u) => dec.decode(u)).join("\n");
        db.close();
        resolve(out);
      };
      req.onerror = () => reject(req.error);
    };
  }));
}

test("pełny przebieg: zablokuj, kłódka, odblokuj złym i dobrym hasłem, zdejmij blokadę @smoke", async ({ page }) => {
  await addNote(page, TITLE, `Treść z ${SECRET} do ukrycia`);
  await setUpVaultAndLock(page);

  // Odblokowana sesja pokazuje zwykłą kartę; blokada przez paletę zamienia ją w kłódkę.
  await expect(card(page, TITLE)).toContainText(SECRET);
  await lockNowFromPalette(page);
  const tile = page.locator("[data-private-tile]");
  await expect(tile).toContainText("Notatka prywatna");
  await expect(tile.getByText("Odblokuj")).toBeVisible();

  // Brak treści w DOM.
  const html = await page.content();
  expect(html).not.toContain(SECRET);
  expect(html).not.toContain(TITLE);

  // Wyszukiwarka nie znajduje ani po tytule, ani po treści.
  const search = page.getByPlaceholder("Szukaj notatek...").first();
  await search.fill(SECRET);
  await expect(tile).toHaveCount(0);
  await search.fill("Zebranie");
  await expect(tile).toHaveCount(0);
  await search.fill("");
  await expect(tile).toBeVisible();

  // Paleta też jej nie zna.
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/Szukaj notatek/).last().fill("Zebranie");
  await expect(page.getByRole("option", { name: /Zebranie/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Zły hasło → błąd; dobre → treść wraca.
  const dialog = await unlockViaTile(page, "zle-haslo-xyz-000");
  await expect(dialog.getByRole("alert")).toHaveText("Nieprawidłowe hasło.");
  await dialog.getByLabel("Hasło skarbca").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Odblokuj" }).click();
  await expect(card(page, TITLE)).toContainText(SECRET);
  await expect(tile).toHaveCount(0);

  // Zdjęcie blokady: zwykła notatka, znowu w wyszukiwarce.
  const c = await openMenu(page, TITLE);
  await c.getByRole("button", { name: "Zdejmij blokadę" }).click();
  await expect(page.getByText("Zdjęto blokadę")).toBeVisible();
  await search.fill(SECRET);
  await expect(card(page, TITLE)).toBeVisible();
});

test("backup, localStorage i IndexedDB nie zawierają jawnego tekstu; reload zachowuje blokadę", async ({ page }) => {
  await addNote(page, TITLE, `Treść z ${SECRET} do ukrycia`);
  await setUpVaultAndLock(page);
  await lockNowFromPalette(page);

  // Pełny backup: tylko szyfrogram + metadane skarbca.
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Dane" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Pobierz pełny backup teraz" }).click(),
  ]);
  const text = readFileSync((await download.path())!, "utf8");
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain(TITLE);
  const backup = JSON.parse(text);
  expect(backup.notes[0].locked).toBe(true);
  expect(backup.notes[0].vault).toMatch(/^v1\./);
  expect(backup.vault.salt).toBeTruthy();
  expect(JSON.stringify(backup)).not.toContain(PASSWORD);
  await page.keyboard.press("Escape");

  // Dziennik IndexedDB zostaje zagęszczony po zablokowaniu notatki.
  await page.waitForTimeout(2500);
  expect(await dumpDocIdb(page)).not.toContain(SECRET);
  const ls = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
  expect(ls).not.toContain(SECRET);
  expect(ls).not.toContain(PASSWORD);

  // Po przeładowaniu klucz nie istnieje — kłódka zostaje.
  await page.reload();
  const tile = page.locator("[data-private-tile]");
  await expect(tile).toBeVisible();
  expect(await page.content()).not.toContain(SECRET);
  const dialog = await unlockViaTile(page, PASSWORD);
  await expect(dialog).toHaveCount(0);
  await expect(card(page, TITLE)).toContainText(SECRET);
});

test("automatyczna blokada po bezczynności i po ukryciu karty", async ({ page }) => {
  await addNote(page, TITLE, `Treść z ${SECRET} do ukrycia`);
  await setUpVaultAndLock(page);
  await lockNowFromPalette(page);

  // Zegar od teraz „płynie”, ale pozwala przeskakiwać w czasie.
  await page.clock.install();
  await page.clock.resume();

  await unlockViaTile(page, PASSWORD);
  await expect(card(page, TITLE)).toContainText(SECRET);
  await page.clock.fastForward(4 * 60_000);
  await expect(card(page, TITLE)).toContainText(SECRET);
  await page.clock.fastForward(2 * 60_000);
  await expect(page.locator("[data-private-tile]")).toBeVisible();
  expect(await page.content()).not.toContain(SECRET);

  // Ukrycie karty na ponad minutę.
  await unlockViaTile(page, PASSWORD);
  await expect(card(page, TITLE)).toContainText(SECRET);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(61_000);
  await expect(page.locator("[data-private-tile]")).toBeVisible();
  expect(await page.content()).not.toContain(SECRET);
});

test("edycja odblokowanej notatki zapisuje się wyłącznie jako szyfrogram i przeżywa blokadę", async ({ page }) => {
  const EDITED = "NOWYTEKST5530";
  await addNote(page, TITLE, `Treść z ${SECRET} do ukrycia`);
  await setUpVaultAndLock(page);
  await lockNowFromPalette(page);
  await unlockViaTile(page, PASSWORD);

  await card(page, TITLE).getByText(TITLE).click();
  const body = card(page, TITLE).getByPlaceholder("Treść notatki...");
  await body.fill(`Zmieniona treść ${EDITED}`);
  await card(page, TITLE).getByRole("button", { name: "Zapisz" }).click();
  await expect(card(page, TITLE)).toContainText(EDITED);

  await lockNowFromPalette(page);
  expect(await page.content()).not.toContain(EDITED);
  // Dziennik IndexedDB: ani nowy, ani stary tekst nie leży jawnie.
  await page.waitForTimeout(2500);
  const idb = await dumpDocIdb(page);
  expect(idb).not.toContain(EDITED);
  expect(idb).not.toContain(SECRET);

  await page.reload();
  await unlockViaTile(page, PASSWORD);
  await expect(card(page, TITLE)).toContainText(EDITED);
});

test("kłódka skarbca w nagłówku: odblokowany → stuknięcie blokuje; zablokowany → stuknięcie otwiera odblokowanie (2.1)", async ({ page }) => {
  await addNote(page, TITLE, SECRET);
  await setUpVaultAndLock(page);
  // Po założeniu skarbiec jest odblokowany: kłódka pokazuje stan otwarty.
  await expect(page.getByRole("button", { name: /^Skarbiec odblokowany/ })).toBeVisible();

  await page.getByRole("button", { name: /^Skarbiec odblokowany/ }).click();
  await expect(page.getByRole("button", { name: /^Skarbiec zablokowany/ })).toBeVisible();

  await page.getByRole("button", { name: /^Skarbiec zablokowany/ }).click();
  const unlock = page.getByRole("dialog").first();
  await expect(unlock).toBeVisible();
  await unlock.getByLabel("Hasło skarbca").fill(PASSWORD);
  await unlock.getByRole("button", { name: "Odblokuj" }).click();
  await expect(page.getByRole("button", { name: /^Skarbiec odblokowany/ })).toBeVisible();
});
