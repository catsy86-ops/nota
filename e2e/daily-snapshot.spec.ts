import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Z-16.1 część A (`docs/plan-dane-lokalne.md` §1.3–1.4): kopia dzienna w prawdziwym OPFS po schowaniu karty,
// lista w Ustawieniach → Kopia i dane i wiersz w karcie trwałości.

async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    // Z powrotem widoczna — reszta aplikacji nie ma myśleć, że karta jest schowana.
    delete (document as unknown as { visibilityState?: string }).visibilityState;
  });
}

const snapshotFiles = (page: Page) => page.evaluate(async () => {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle("kopie-dzienne", { create: true });
  const names: string[] = [];
  for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
  return names.sort();
});

test("przywracanie z kopii dziennej: notatka usunięta przez przywrócenie pliku wraca jako kopia w „Przywrócone DD.MM”", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "OPFS z createWritable sprawdzany w Chromium");
  test.setTimeout(90_000);
  const now = Date.now();
  const mk = (id: string, title: string) => ({
    id, title, content: `Treść: ${title}`, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: now, updatedAt: now,
  });
  await page.addInitScript((notes) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
    }
    // Bez przeładowania po przywróceniu pliku w tym teście nie da się dojść do kopii dziennej — przeładowanie zostaje.
  }, [mk("odz", "Notatka do odzyskania"), mk("zos", "Zostaje")]);
  await page.goto("/");
  await expect(page.getByText("Notatka do odzyskania").first()).toBeVisible();

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.nkopia`;
  });
  await expect(async () => {
    await hideTab(page);
    expect(await snapshotFiles(page)).toContain(today);
  }).toPass({ timeout: 20_000 });

  // Przywrócenie pliku kopii bez notatki „Notatka do odzyskania” — wymiana usuwa ją z dokumentu.
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Przywróć z pliku kopii" }).click();
  await (await chooser).setFiles({ name: "kopia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ version: 3, exportedAt: now, notes: [mk("zos", "Zostaje")], folders: [], labels: [] })) });
  const reloaded = page.waitForEvent("load", { timeout: 30_000 });
  await page.getByRole("button", { name: "Przywróć kopię" }).click();
  await reloaded;
  await expect(page.getByText("Zostaje").first()).toBeVisible();
  await expect(page.getByText("Notatka do odzyskania")).toHaveCount(0);

  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  await page.getByRole("button", { name: /Przywróć notatki z kopii z/ }).click();
  const dialog = page.getByRole("dialog", { name: /Przywróć z dnia/ });
  await expect(dialog.getByRole("heading", { name: "Usunięte od tamtej pory (1)" })).toBeVisible();
  await dialog.getByRole("checkbox", { name: /Notatka do odzyskania/ }).check();
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await dialog.getByRole("button", { name: "Przywróć zaznaczone (1)" }).click();
  await expect(page.getByText(/Przywrócono 1 notatkę do folderu „Przywrócone \d\d\.\d\d”/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Notatka do odzyskania").first()).toBeVisible();
});

test("baza usunięta ręcznie → baner „dane zniknęły” → przywrócenie całego dokumentu z kopii dziennej", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "OPFS z createWritable sprawdzany w Chromium");
  test.setTimeout(120_000);
  const now = Date.now();
  await page.addInitScript((n) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy-notes-data", JSON.stringify([{
        id: "w1", title: "Ważna notatka", content: "Nie może zginąć", color: "default", pinned: false, archived: false, trashed: false,
        trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: n, updatedAt: n,
      }]));
    }
  }, now);
  await page.goto("/");
  await expect(page.getByText("Ważna notatka").first()).toBeVisible();
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.nkopia`;
  });
  await expect(async () => {
    await hideTab(page);
    expect(await snapshotFiles(page)).toContain(today);
  }).toPass({ timeout: 20_000 });

  // „Uszkodzenie”: baza dokumentu usunięta (y-indexeddb zamyka połączenie przy versionchange).
  await page.evaluate(() => new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("kaczy-yjs-v1");
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  }));
  await page.reload();
  const banner = page.getByTestId("data-loss");
  await expect(banner).toContainText("Wygląda na to, że dane zniknęły");
  await expect(page.getByText("Ważna notatka")).toHaveCount(0);

  await banner.getByRole("button", { name: "Kopie dzienne" }).click();
  await page.getByRole("button", { name: /Przywróć notatki z kopii z/ }).first().click();
  const dialog = page.getByRole("dialog", { name: /Przywróć z dnia/ });
  await dialog.getByRole("button", { name: "Przywróć cały dokument…" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Przywrócić cały dokument?" });
  await expect(confirm).toContainText("Zmiany zrobione później znikną z tego urządzenia");
  const reloaded = page.waitForEvent("load", { timeout: 30_000 });
  await confirm.getByRole("button", { name: "Przywróć cały dokument" }).click();
  await reloaded;

  await expect(page.getByText("Ważna notatka").first()).toBeVisible();
  const notice = page.getByTestId("doc-replace-result");
  await expect(notice).toContainText("Przywrócono dane z");
  await expect(page.getByTestId("data-loss")).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('[data-testid="doc-replace-result"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
  await notice.getByRole("button", { name: "Zamknij" }).click();
  await expect(notice).toHaveCount(0);

  // Kopia stanu sprzed wymiany (pustego) jest na liście, oznaczona.
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  await expect(page.getByRole("list", { name: "Kopie dzienne" })).toContainText("sprzed przywrócenia");
});

test("kopia dzienna: zapis po schowaniu karty, lista i wiersz w Ustawieniach, bez uwag axe", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "OPFS z createWritable sprawdzany w Chromium");
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().waitFor();

  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.nkopia`;
  });
  await expect(async () => {
    await hideTab(page);
    expect(await snapshotFiles(page)).toContain(today);
  }).toPass({ timeout: 20_000 });
  const header = await page.evaluate(async (name) => {
    const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("kopie-dzienne");
    const bytes = new Uint8Array(await (await (await dir.getFileHandle(name)).getFile()).arrayBuffer());
    return new TextDecoder().decode(bytes.subarray(0, 4));
  }, today);
  expect(header).toBe("NKD1");

  // Druga próba tego samego dnia nie dokłada pliku.
  await hideTab(page);
  expect((await snapshotFiles(page)).filter((f) => f.endsWith(".nkopia"))).toEqual([today]);

  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Kopia i dane" }).click();
  await expect(page.getByText(/Kopia dzienna: dziś, \d+ notat/)).toBeVisible();
  const list = page.getByRole("list", { name: "Kopie dzienne" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(list).toContainText(new Date().toLocaleDateString("pl-PL"));
  const axe = await new AxeBuilder({ page }).include('[aria-label="Kopie dzienne"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});
