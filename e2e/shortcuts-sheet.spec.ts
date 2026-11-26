import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// Q5.2: ściąga pod „?” — klawisze i polecenia palety z jednego rejestru, z wyszukiwaniem bez polskich znaków.

test("„?” otwiera ściągę z poleceniami palety; „zrob kopie” bez ogonków znajduje polecenie z rejestru; brak trafień ma komunikat", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.locator("body").click({ position: { x: 700, y: 600 } });
  await page.keyboard.press("?");
  const sheet = page.getByTestId("shortcuts-dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /Paleta poleceń.*Akcje/ })).toBeVisible();

  await sheet.getByLabel("Szukaj skrótu lub polecenia").fill("zrob kopie");
  await expect(sheet.getByText("Zrób kopię teraz")).toBeVisible();
  await expect(sheet.getByText("Nowa notatka")).toHaveCount(0);

  await sheet.getByLabel("Szukaj skrótu lub polecenia").fill("xyzzy");
  await expect(sheet.getByText(/Nic nie pasuje/)).toBeVisible();

  await sheet.getByLabel("Szukaj skrótu lub polecenia").fill("");
  const axe = await new AxeBuilder({ page }).include('[data-testid="shortcuts-dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
