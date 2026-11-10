import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { inCard } from "./helpers";

// H5.2 Paczka budowy: „Wyślij budowę” zapisuje plik .budowa, druga osoba wczytuje go w „Nowa budowa → Z pliku”.

async function setup(page: Page, seed: boolean) {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript((seed) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    // Bez systemowego udostępniania — plik idzie do pobrania.
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
    if (!seed || sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "problem", topic: null, text: "Przeciek pod wanną", site: "Lipowa 5", checked: [], images: [], owner: "Hydro-Bud" }],
    }));
  }, seed);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
}

test("paczka budowy: eksport z brakiem i wpisem, import u drugiej osoby jako nowa budowa", async ({ page, browser }) => {
  await setup(page, true);
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  const card = page.getByTestId("site-card");
  const shortages = (await inCard(card, "site-shortages"));
  await shortages.getByLabel("Czego brakuje").fill("Rura PEX 16");
  await shortages.getByRole("button", { name: "Dodaj brak" }).click();

  await (await inCard(card, "site-package-open")).click();
  const dialog = page.getByTestId("site-package-export");
  await expect(dialog.getByRole("checkbox", { name: /Dostęp do budowy/ })).not.toBeChecked();
  const axe = await new AxeBuilder({ page }).include("[data-testid='site-package-export']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axe.violations).toEqual([]);
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Wyślij plik" }).click()]);
  expect(download.suggestedFilename()).toBe("Lipowa 5.budowa");
  const path = await download.path();
  const raw = JSON.parse(await (await import("node:fs/promises")).readFile(path, "utf8"));
  expect(raw.entries[0].owner).toBeUndefined();
  expect(raw.shortages[0].text).toBe("Rura PEX 16");

  // Druga osoba: osobny kontekst, puste dane.
  const other = await browser.newContext();
  const helper = await other.newPage();
  await setup(helper, false);
  await helper.getByRole("button", { name: /Nowa budowa/ }).click();
  await helper.getByTestId("site-package-file").setInputFiles(path);
  const imp = helper.getByTestId("site-package-import");
  await expect(imp.getByRole("button", { name: /Lipowa 5.*nowa budowa/ })).toHaveAttribute("aria-pressed", "true");
  await expect(imp.getByTestId("site-package-summary")).toHaveText("Dojdzie: 1 nowy wpis, braki: 1.");
  const axeImp = await new AxeBuilder({ page: helper }).include("[data-testid='site-package-import']").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  expect(axeImp.violations).toEqual([]);
  await imp.getByRole("button", { name: "Wczytaj" }).click();

  const helperCard = helper.getByTestId("site-card");
  await expect(helperCard).toBeVisible();
  await expect((await inCard(helperCard, "site-shortages")).getByText("Rura PEX 16")).toBeVisible();
  await helper.keyboard.press("Escape");
  await expect(helper.getByTestId("study-journal").getByText("Przeciek pod wanną")).toBeVisible();

  // Ten sam plik drugi raz: nic nowego, przycisk wyłączony.
  await helper.getByRole("button", { name: /Nowa budowa/ }).click();
  await helper.getByTestId("site-package-file").setInputFiles(path);
  await expect(imp.getByRole("button", { name: /Lipowa 5.*istniejąca/ })).toHaveAttribute("aria-pressed", "true");
  // „Nowa budowa” nigdy na zajętym id — inaczej nadpisałaby istniejącą kartę.
  await expect(imp.getByRole("button", { name: /Lipowa 5 \(od pomocnika\).*nowa budowa/ })).toBeVisible();
  await expect(imp.getByTestId("site-package-summary")).toHaveText("Nic nowego — wszystko z pliku już jest.");
  await expect(imp.getByRole("button", { name: "Wczytaj" })).toBeDisabled();
  await other.close();
});

test("paczka budowy: obcy plik daje komunikat, nie okno", async ({ page }) => {
  await setup(page, false);
  await page.getByRole("button", { name: /Nowa budowa/ }).click();
  await page.getByTestId("site-package-file").setInputFiles({ name: "x.budowa", mimeType: "application/json", buffer: Buffer.from("{\"format\":\"inny\"}") });
  await expect(page.getByText("To nie jest plik budowy.")).toBeVisible();
  await expect(page.getByTestId("site-package-import")).toHaveCount(0);
});
