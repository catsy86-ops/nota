import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 6, 10, 0, 0));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

const body = (page: import("@playwright/test").Page) => page.getByPlaceholder("Treść notatki...");

test("#etykieta, @folder i !! stają się chipami i są stosowane przy zapisie", async ({ page }) => {
  const folder = `Fold${Date.now() % 100000}`;
  const label = `lab${Date.now() % 100000}`;
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await page.getByPlaceholder("Nazwa...").fill(folder);
  await page.getByPlaceholder("Nazwa...").press("Enter");

  await page.getByText("Zapisz notatkę...").click();
  await body(page).fill(`Raport kwartalny #${label} @${folder.toLowerCase()} !!`);

  const chips = page.getByRole("group", { name: "Rozpoznane w tekście" });
  await expect(chips.getByRole("button", { name: `Zignoruj: Nowa etykieta ${label}` })).toBeVisible();
  await expect(chips.getByRole("button", { name: `Zignoruj: Folder ${folder}` })).toBeVisible();
  await expect(chips.getByRole("button", { name: "Zignoruj: Priorytet wysoki" })).toBeVisible();

  await page.getByRole("button", { name: "Zamknij" }).click();
  await page.getByText(folder, { exact: true }).first().click();
  const card = page.locator("[data-note-id]").filter({ hasText: "Raport kwartalny" });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(`#${label}`);
  await expect(card).not.toContainText("!!");
  await expect(card.getByText(label)).toBeVisible();
  await expect(card.getByTitle("Priorytet: wysoki")).toBeVisible();
});

test("zignorowany chip zostawia token w tekście; klawiatura Backspace też ignoruje", async ({ page }) => {
  const title = `Ign ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await body(page).fill("zrób to #pilneee");
  const chip = page.getByRole("button", { name: /Zignoruj: Nowa etykieta pilneee/ });
  await chip.focus();
  await page.keyboard.press("Backspace");
  await expect(page.getByRole("button", { name: /Przywróć: Nowa etykieta pilneee/ })).toBeVisible();
  await page.getByRole("button", { name: "Zamknij" }).click();
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await expect(card).toContainText("zrób to #pilneee");
});

test("# w adresie URL i e-mail z @ nie dają chipów", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await body(page).fill("https://example.com/strona#sekcja oraz jan@example.com");
  await expect(page.getByRole("group", { name: "Rozpoznane w tekście" })).toHaveCount(0);
  await body(page).fill("# Nagłówek");
  await expect(page.getByRole("group", { name: "Rozpoznane w tekście" })).toHaveCount(0);
});

test("fraza „jutro 9:00” jako chip przypomnienia i wycięta z treści", async ({ page }) => {
  const title = `Data ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await body(page).fill("Zadzwonić do lekarza jutro 9:00");
  await expect(page.getByRole("button", { name: "Zignoruj: Przypomnienie jutro, 09:00" })).toBeVisible();
  await expect(page.getByText("Przypomnienie: jutro, 09:00")).toBeVisible();
  await page.getByRole("button", { name: "Zamknij" }).click();
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await expect(card).toContainText("Zadzwonić do lekarza");
  await expect(card).not.toContainText("jutro 9:00");
  await expect(card).toContainText("jutro, 09:00");
});

test("zignorowana data zostaje w tekście i nie ustawia przypomnienia", async ({ page }) => {
  const title = `DataIgn ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await body(page).fill("Kupić chleb jutro 9:00");
  await page.getByRole("button", { name: "Zignoruj: Przypomnienie jutro, 09:00" }).click();
  await page.getByRole("button", { name: "Zamknij" }).click();
  const card = page.locator("[data-note-id]").filter({ hasText: title });
  await expect(card).toContainText("Kupić chleb jutro 9:00");
  await expect(card).not.toContainText("jutro, 09:00");
});

test("Ctrl+Shift+L zamienia zaznaczone linie na listę zadań w pasku nowej notatki", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  const ta = body(page);
  await ta.fill("wstęp\nmleko\nchleb");
  // Zaznaczenie od początku „mleko” do końca tekstu.
  await ta.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(el.value.indexOf("mleko"), el.value.length); });
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByLabel("Odhacz: mleko")).toBeVisible();
  await expect(page.getByLabel("Odhacz: chleb")).toBeVisible();
  await expect(ta).toHaveValue("wstęp");
});

test("Ctrl+Shift+L w edycji istniejącej notatki zamienia bieżącą linię", async ({ page }) => {
  const title = `Skrot ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await body(page).fill("alfa\nbeta");
  await page.getByRole("button", { name: "Zamknij" }).click();

  await page.getByText(title).click();
  const ta = body(page).last();
  await ta.evaluate((el: HTMLTextAreaElement) => { el.focus(); el.setSelectionRange(el.value.length, el.value.length); });
  await page.keyboard.press("Control+Shift+L");
  await expect(page.getByLabel("Odhacz: beta")).toBeVisible();
  await expect(ta).toHaveValue("alfa");
});

test("skrót jest na liście skrótów", async ({ page }) => {
  await page.keyboard.press("?");
  await expect(page.getByText("Zaznaczone linie na listę zadań")).toBeVisible();
});
