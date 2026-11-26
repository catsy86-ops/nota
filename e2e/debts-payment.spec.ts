import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// L2.3: dane do przelewu w Długach — zapis na urządzeniu, walidacja i przełącznik w arkuszu osoby.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

async function openDebtForm(page: Page) {
  const form = page.getByRole("form", { name: "Nowy wpis" });
  if (await form.isVisible()) return form;
  await page.getByRole("button", { name: /^(Nowy wpis|Dodaj pierwszy wpis)$/ }).first().click();
  await expect(form).toBeVisible();
  return form;
}

test("dane do przelewu: zły BLIK nie zapisuje, dobre dane zostają po przeładowaniu i pokazują się przy osobie", async ({ page }) => {
  await page.goto("/dlugi");
  const settings = page.getByTestId("debt-payment-settings");
  await settings.getByText("Dane do przelewu").click();

  await settings.getByLabel("Telefon do BLIK-a").fill("60012345");
  await settings.getByLabel("Numer konta").click();
  await expect(settings.getByRole("alert")).toContainText("9 cyfr");

  await settings.getByLabel("Telefon do BLIK-a").fill("+48 600-123-456");
  await settings.getByLabel("Numer konta").fill("61 1090 1014 0000 0712 1981 2874");
  await settings.getByLabel("Telefon do BLIK-a").click();
  await expect(settings.getByLabel("Numer konta")).toHaveValue("PL61 1090 1014 0000 0712 1981 2874");
  await page.getByRole("heading").first().click();
  await expect(settings.getByLabel("Telefon do BLIK-a")).toHaveValue("600 123 456");

  await page.reload();
  await page.getByTestId("debt-payment-settings").getByText("Dane do przelewu").click();
  await expect(page.getByTestId("debt-payment-settings").getByLabel("Numer konta")).toHaveValue("PL61 1090 1014 0000 0712 1981 2874");

  const person = `Płatnik ${Date.now()}`;
  const form = await openDebtForm(page);
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill(person);
  await form.getByLabel("Kwota (zł)").fill("50");
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await page.getByRole("button", { name: new RegExp(person) }).first().click();
  const toggle = page.getByTestId("debt-payment-toggle");
  await expect(toggle).toContainText("BLIK: 600 123 456");
  await expect(toggle.getByRole("checkbox")).toBeChecked();
  // WCAG 2.2 AA w arkuszu osoby z przełącznikiem (Długów nie ma w a11y.spec.ts).
  await page.emulateMedia({ reducedMotion: "reduce" });
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});

test("dane do przelewu: formularz bez naruszeń axe (z błędem walidacji)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dlugi");
  const settings = page.getByTestId("debt-payment-settings");
  await settings.getByText("Dane do przelewu").click();
  await settings.getByLabel("Numer konta").fill("PL62 1090 1014 0000 0712 1981 2874");
  await expect(settings.getByRole("status")).toContainText("Suma kontrolna");
  const axe = await new AxeBuilder({ page }).include('[data-testid="debt-payment-settings"]').withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
});
