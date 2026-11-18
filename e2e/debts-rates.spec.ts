import { test, expect } from "@playwright/test";

// L2.1 Raty (Z-17.4): pożyczka w 6 ratach, „Rata wpłacona” przesuwa na następną, notatka serii w Terminach.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("raty: plan, „Rata wpłacona” z „Cofnij”, notatka w Terminach", async ({ page }) => {
  const person = `Ratalny ${Date.now()}`;
  const d = new Date(Date.now() + 2 * 86_400_000);
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.goto("/dlugi");
  const form = page.getByRole("form", { name: "Nowy wpis" });
  if (!(await form.isVisible())) await page.getByRole("button", { name: /^(Nowy wpis|Dodaj pierwszy wpis)$/ }).first().click();
  await form.getByRole("radio", { name: "Pożyczyłem", exact: true }).click();
  await form.getByLabel("Kto").fill(person);
  await form.getByLabel("Kwota (zł)").fill("600");
  await form.getByLabel("W ratach (co miesiąc)").check();
  await form.getByLabel("Liczba rat").fill("6");
  await expect(form.getByText("Rata: 100,00 zł")).toBeVisible();
  await form.getByLabel(/Pierwsza rata/).fill(first);
  await form.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(page.getByText(/Pożyczyłem: /).first()).toBeVisible();

  await page.getByRole("button", { name: new RegExp(`^${person}`) }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByTestId("debt-plan-next")).toContainText("Rata 1 z 6 · 100,00 zł");
  await sheet.getByRole("button", { name: /Rata wpłacona/ }).click();
  await expect(sheet.getByTestId("debt-plan-next")).toContainText("Rata 2 z 6");
  await expect(sheet.getByText("Do oddania: 500,00 zł")).toBeVisible();
  await page.locator("[data-sonner-toast]").filter({ hasText: "Rata 1 z 6" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(sheet.getByTestId("debt-plan-next")).toContainText("Rata 1 z 6");

  await page.goto("/przypomnienia");
  await expect(page.getByText(`Zwrot od ${person}: 100,00 zł (rata)`).first()).toBeVisible();
});
