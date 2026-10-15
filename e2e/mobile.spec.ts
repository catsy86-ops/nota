import { test, expect } from "@playwright/test";

// Telefon: pasek boczny jest domyślnie zamknięty, więc wszystko, co żyło
// tylko w nim, było nieosiągalne z dolnej nawigacji.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("„Więcej” → Ustawienia otwiera ustawienia przy zamkniętym pasku bocznym @smoke", async ({ page }) => {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).last().click();
  await expect(page.getByRole("dialog", { name: "Ustawienia" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Dane/ })).toBeVisible();
});

test("Ustawienia na telefonie zajmują cały ekran i nie zmieniają wysokości przy zmianie zakładki @smoke", async ({ page }) => {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Ustawienia" }).last().click();
  const dialog = page.getByRole("dialog", { name: "Ustawienia" });
  await expect(dialog).toBeVisible();

  const heights: number[] = [];
  for (const tab of ["Wygląd", "Ogólne", "Dane", "Sync"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("data-state", "active");
    heights.push(Math.round((await dialog.boundingBox())!.height));
  }
  expect(new Set(heights).size).toBe(1);
  expect(heights[0]).toBe(844);
});

test("na dotyku akcje kafla są schowane za „Więcej opcji”", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Kafel na telefonie");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const card = page.locator("[data-note-idx]").filter({ hasText: "Kafel na telefonie" });
  await expect(card.getByRole("button", { name: "Przypnij" })).toBeHidden();
  await card.getByRole("button", { name: "Więcej opcji" }).click();
  // Na dotyku „⋯” otwiera arkusz akcji z podpisami, a nie siatkę ikon w kaflu.
  const sheet = page.getByRole("dialog", { name: "Kafel na telefonie" });
  await expect(sheet.getByRole("button", { name: "Przypnij" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Duplikuj" })).toBeVisible();
  await sheet.getByRole("button", { name: "Przypnij" }).click();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("button", { name: "Przypnij" })).toBeHidden();
});

test("przytrzymanie kafla zaznacza go i pokazuje pasek zbiorczy", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Do zaznaczenia");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const body = page.locator("[data-note-idx]").filter({ hasText: "Do zaznaczenia" }).getByRole("heading", { name: "Do zaznaczenia" });
  const box = (await body.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await page.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByText(/zaznaczono/)).toBeAttached();
  await expect(page.getByRole("button", { name: "Wyczyść zaznaczenie" })).toBeVisible();
  // Bez otwierania edytora po puszczeniu palca.
  await expect(page.getByRole("dialog", { name: /Edycja notatki/ })).toHaveCount(0);
});

test("Przypomnienia mają własną zakładkę w dolnym pasku, Archiwum jest w „Więcej”", async ({ page }) => {
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Przypomnienia" }).click();
  await expect(page.getByRole("heading", { name: "Przypomnienia", level: 1 })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Przypomnienia" })).toHaveAttribute("aria-current", "page");

  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("button", { name: "Archiwum" }).last().click();
  await expect(page.getByRole("heading", { name: "Archiwum", level: 1 })).toBeVisible();
});

test("notatka z listą na pełnym ekranie: pozycje zaraz pod tytułem, nie na dole", async ({ page }) => {
  const title = `E2E-lista ${Date.now()}`;
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill("mleko\nchleb\njajka");
  await page.getByRole("button", { name: "Zamień na listę" }).click();
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  await page.getByText(title).click();
  const dialog = page.getByRole("dialog");
  const first = dialog.getByLabel("Odhacz: mleko");
  await expect(first).toBeVisible();
  const box = (await first.boundingBox())!;
  expect(box.y).toBeLessThan(844 / 2);
});

test("„wstecz” zamyka arkusz „Więcej”, a nie zmienia widoku pod nim @smoke", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "Dziś" }).click();
  await expect(page).toHaveURL(/\/dzis$/);
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Więcej" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("dialog", { name: "Więcej" })).toBeHidden();
  await expect(page).toHaveURL(/\/dzis$/);

  // Kolejne „wstecz” wraca do poprzedniego widoku, bez wpisów-duchów po arkuszu.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/dzis$/);
});

test("zamknięcie arkusza krzyżykiem nie zostawia dodatkowego wpisu w historii", async ({ page }) => {
  await page.getByRole("navigation").getByRole("button", { name: "Dziś" }).click();
  await expect(page).toHaveURL(/\/dzis$/);
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("dialog", { name: "Więcej" }).getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByRole("dialog", { name: "Więcej" })).toBeHidden();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/dzis$/);
});

test("„wstecz” zwija pełnoekranowy kompozytor, szkic zostaje", async ({ page }) => {
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill("Szkic przy wstecz");
  await page.goBack();
  await expect(page.getByPlaceholder("Tytuł")).toBeHidden();
  await expect(page).toHaveURL(/localhost:4173\/?$/);
});

test("arkusz „Więcej” zamyka się przeciągnięciem uchwytu w dół, krótki ruch go nie zamyka", async ({ page }) => {
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Więcej" });
  await expect(sheet).toBeVisible();
  const handle = sheet.locator("[data-sheet-handle]");
  // Pozycję mierzymy po wjeździe arkusza — w trakcie animacji uchwyt jest niżej.
  await page.waitForTimeout(500);
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const drag = async (dist: number) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dist * i) / 6 }] });
      await page.waitForTimeout(40);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await drag(40);
  await page.waitForTimeout(300);
  await expect(sheet).toBeVisible();
  await drag(220);
  await expect(sheet).toBeHidden();
});

test("ponowne stuknięcie „Notatki” i „Więcej → Szukaj” ustawiają kursor w wyszukiwarce", async ({ page }) => {
  const nav = page.getByRole("navigation");
  await nav.getByRole("button", { name: "Notatki" }).click();
  await expect(page.getByRole("searchbox", { name: "Szukaj w notatkach" })).toBeFocused();

  await page.getByRole("searchbox", { name: "Szukaj w notatkach" }).blur();
  await nav.getByRole("button", { name: "Dziś" }).click();
  await page.getByRole("button", { name: "Więcej", exact: true }).click();
  await page.getByRole("dialog", { name: "Więcej" }).getByRole("button", { name: "Szukaj" }).click();
  await expect(page).not.toHaveURL(/\/dzis$/);
  await expect(page.getByRole("searchbox", { name: "Szukaj w notatkach" })).toBeFocused();
});

test.describe("telefon w poziomie", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("zostaje dolna nawigacja, a panel boczny nie zajmuje 1/3 ekranu", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Nowa notatka" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Więcej", exact: true })).toBeVisible();
    // Panel jest wysuwany na żądanie, nie stały w układzie.
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });
});

test("dolny pasek chowa się, gdy klawiatura Androida zmniejsza okno przy pisaniu @mobile", async ({ page }) => {
  const nav = page.locator("nav").filter({ has: page.getByRole("button", { name: "Więcej", exact: true }) });
  await expect(nav).toBeVisible();
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").focus();
  // `interactive-widget=resizes-content`: klawiatura zmniejsza całe okno.
  await page.setViewportSize({ width: 390, height: 500 });
  await expect(page.locator("html")).toHaveAttribute("data-typing", "");
  await expect(nav).toBeHidden();
  // Klawiatura schowana „wstecz”, pole dalej ma fokus — pasek wraca.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("html")).not.toHaveAttribute("data-typing", "");
  await expect(nav).toBeVisible();
});
