import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

/** WCAG 2.2 AA w obrębie panelu wymiany (karta Sync nie jest w `a11y.spec.ts`). */
async function axe(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page }).include('[data-testid="code-change"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.length}`);
}

// Z-15.3: „Zmień kod” w Ustawieniach → Sync. Bez przekaźnika kroki 2 i 5 są puste, więc wymiana dochodzi do końca
// bez sieci; kod w „Dodaj urządzenie” zmienia się na długi, a lista urządzeń do ponownego sparowania czeka na odhaczenie.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: "ABCD2345EFGH", signaling: [], legacyRoom: false, v2Until: null }));
      localStorage.setItem("kaczy.sync.seen.v1", JSON.stringify({ Tablet: Date.now() - 60_000 }));
    }
  });
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("zmiana kodu: potwierdzenie, przełączenie na kod długi, lista do sparowania", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();

  const panel = page.getByTestId("code-change");
  await panel.getByRole("button", { name: "Zmień kod" }).click();
  await expect(panel.getByText("Zmienić kod synchronizacji?")).toBeVisible();
  await expect(panel.getByText("Tablet")).toBeVisible();
  await expect(panel.getByText(/nie dostaną informacji o zmianie/)).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await panel.getByRole("button", { name: "Zmień kod" }).click();
  await expect(panel.getByRole("checkbox", { name: "Tablet" })).toBeVisible({ timeout: 30_000 });

  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.sync.v1") ?? "{}") as { code: string });
  expect(prefs.code).toHaveLength(28);
  // S1.5(b): kod jest ukryty, dopóki się go nie pokaże.
  await page.getByRole("button", { name: "Pokaż kod i QR" }).click();
  await expect(page.getByText(prefs.code.slice(0, 4), { exact: true })).toBeVisible();
  expect(await axe(page)).toEqual([]);

  // Odhaczenie ostatniego urządzenia kończy wymianę — zapis znika, wraca przycisk „Zmień kod”.
  await panel.getByRole("checkbox", { name: "Tablet" }).click();
  await expect(panel.getByRole("button", { name: "Zmień kod" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kaczy.sync.rekey.v1"))).toBeNull();
});

test("anulowanie przed potwierdzeniem nie zmienia kodu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();
  const panel = page.getByTestId("code-change");
  await panel.getByRole("button", { name: "Zmień kod" }).click();
  await panel.getByRole("button", { name: "Anuluj" }).click();
  await expect(panel.getByRole("button", { name: "Zmień kod" })).toBeVisible();
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.sync.v1") ?? "{}") as { code: string });
  expect(prefs.code).toBe("ABCD2345EFGH");
});
