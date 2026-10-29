import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// F1.1: pierścień postępu przy przytrzymaniu „+” na telefonie.

test.use({ viewport: { width: 390, height: 844 } });

// Pasek wjeżdża animacją (y: 80 → 0); mierzymy dopiero, gdy stoi na miejscu.
async function settledFab(page: import("@playwright/test").Page) {
  const fab = page.getByRole("button", { name: "Nowa notatka", exact: true });
  await expect.poll(async () => (await fab.boundingBox())?.y ?? 9999).toBeLessThan(800);
  return fab;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("przytrzymanie „+” pokazuje pierścień, a zwolnienie przed progiem go kasuje", async ({ page }) => {
  const fab = await settledFab(page);
  const ring = page.getByTestId("fab-ring");
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(ring).toHaveAttribute("data-pressing", "true");
  await page.mouse.up();
  await expect(ring).toHaveAttribute("data-pressing", "false");
  // Krótkie stuknięcie nie otwiera arkusza „Nowa” — to zwykły klik.
  await expect(page.getByRole("dialog", { name: "Nowa" })).toHaveCount(0);
});

test("przytrzymanie dłużej niż 420 ms otwiera arkusz „Nowa”", async ({ page }) => {
  const fab = await settledFab(page);
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Nowa" })).toBeVisible();
});

// F1.2: kafel „Z przypomnieniem” w arkuszu „Nowa” otwiera kompozytor z pickerem terminu.
test("kafel „Z przypomnieniem” otwiera kompozytor z pickerem terminu", async ({ page }) => {
  const fab = await settledFab(page);
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const sheet = page.getByRole("dialog", { name: "Nowa" });
  await expect(sheet).toBeVisible();
  // Kolejność: notatka, termin, lista…
  const tiles = sheet.getByRole("group", { name: "Rodzaj nowej notatki" }).locator("button");
  await expect(tiles.nth(1)).toContainText("Z przypomnieniem");
  await sheet.getByRole("button", { name: /Z przypomnieniem/ }).click();
  await expect(page.getByRole("group", { name: "Szybkie terminy" })).toBeVisible();
});

// F1.3: ostatnio wybrany rodzaj wraca na górę arkusza „Nowa” z odznaką „Ostatnio”.
test("ostatnio wybrany rodzaj jest pierwszy w arkuszu z odznaką", async ({ page }) => {
  const openSheet = async () => {
    const fab = await settledFab(page);
    const box = await fab.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    return page.getByRole("dialog", { name: "Nowa" });
  };
  const sheet = await openSheet();
  await sheet.getByRole("button", { name: /Lista zadań/ }).click();
  await page.goto("/");
  const again = await openSheet();
  const tiles = again.getByRole("group", { name: "Rodzaj nowej notatki" }).locator("button");
  await expect(tiles.nth(0)).toContainText("Lista zadań");
  await expect(tiles.nth(0)).toContainText("Ostatnio");
});

// F1.4: „+” chowa się przy przewijaniu w dół na liście notatek i wraca przy przewijaniu w górę.
test("„+” chowa się przy przewijaniu w dół i wraca w górę", async ({ page }) => {
  const notes = Array.from({ length: 60 }, (_, i) => ({
    id: `fab-${i}`, title: `Notatka ${i}`, content: "Treść do przewijania", color: "default", pinned: false, archived: false, labels: [], createdAt: Date.now() - i, updatedAt: Date.now() - i,
  }));
  await seedNotes(page, notes);
  await page.goto("/");
  await settledFab(page);
  const li = page.locator('li[data-fab-hidden]');
  await expect(li).toHaveAttribute("data-fab-hidden", "false");
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect(li).toHaveAttribute("data-fab-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, 700));
  await expect(li).toHaveAttribute("data-fab-hidden", "false");
});

// F1.5: kafle arkusza „Nowa” są co najmniej 44 px wysokie i mają nazwę z opisem.
test("kafle arkusza „Nowa” mają co najmniej 44 px i opis w nazwie", async ({ page }) => {
  const fab = await settledFab(page);
  const box = await fab.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.up();
  const tiles = page.getByRole("dialog", { name: "Nowa" }).getByRole("group", { name: "Rodzaj nowej notatki" }).locator("button");
  const n = await tiles.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    const h = (await tiles.nth(i).boundingBox())?.height ?? 0;
    expect(h).toBeGreaterThanOrEqual(44);
  }
  await expect(tiles.nth(0)).toContainText("Pusta kartka do pisania");
});
