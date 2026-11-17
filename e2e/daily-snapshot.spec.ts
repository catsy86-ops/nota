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
