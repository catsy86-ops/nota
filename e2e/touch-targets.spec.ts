import { test, expect, type Locator } from "@playwright/test";

// Cele dotyku ≥ 44 px (plan UI 2026-10-15, 1.4). Tablet w poziomie: dotyk i pasek boczny naraz.
test.use({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true });

/** Rozmiar obszaru, który łapie palec: przycisk plus niewidzialne `::after` wystające poza niego. */
async function targetSize(el: Locator): Promise<{ w: number; h: number }> {
  return el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    let w = r.width;
    let h = r.height;
    const a = getComputedStyle(node, "::after");
    if (a.content !== "none" && a.position === "absolute") {
      const px = (v: string) => (v.endsWith("px") ? parseFloat(v) : 0);
      w = Math.max(w, r.width - px(a.left) - px(a.right));
      h = Math.max(h, r.height - px(a.top) - px(a.bottom));
    }
    return { w: Math.round(w), h: Math.round(h) };
  });
}

async function expectTarget(el: Locator) {
  await expect(el).toBeVisible();
  const { w, h } = await targetSize(el);
  expect(w, "szerokość celu").toBeGreaterThanOrEqual(44);
  expect(h, "wysokość celu").toBeGreaterThanOrEqual(44);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("pasek boczny: „⋯”, rozwinięcie podfolderów i zatwierdzenia nazwy @mobile", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
  const folder = `Cel${Date.now() % 100000}`;
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await expectTarget(page.getByRole("button", { name: "Dodaj folder" }));
  await expectTarget(page.getByRole("button", { name: "Anuluj dodawanie folderu" }));
  await page.getByPlaceholder("Nazwa...").fill(folder);
  await page.getByPlaceholder("Nazwa...").press("Enter");

  await page.getByText(folder, { exact: true }).first().click();
  const menu = page.getByRole("button", { name: `Akcje folderu ${folder}` });
  await expectTarget(menu);

  await menu.click();
  await page.getByRole("menuitem", { name: "Dodaj podfolder" }).click();
  await expectTarget(page.getByRole("button", { name: "Dodaj podfolder" }));
  await expectTarget(page.getByRole("button", { name: "Anuluj dodawanie podfolderu" }));
  await page.getByPlaceholder("Subfolder...").fill("Pod");
  await page.getByPlaceholder("Subfolder...").press("Enter");
  await expectTarget(page.getByRole("button", { name: /Zwiń podfoldery|Rozwiń podfoldery/ }).first());

  await menu.click();
  await page.getByRole("menuitem", { name: "Zmień nazwę" }).click();
  await expectTarget(page.getByRole("button", { name: "Zapisz nazwę folderu" }));
  await expectTarget(page.getByRole("button", { name: "Anuluj edycję folderu" }));
});

test("Grafik: przełącznik widoku, „Ten tydzień”, kopiowanie tygodnia, „Rozumiem” @mobile", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.goto("/grafik");
  await expectTarget(page.getByRole("button", { name: "Rozumiem" }));
  await expectTarget(page.getByRole("button", { name: "Miesiąc", exact: true }));
  await page.getByRole("button", { name: "Tydzień", exact: true }).click();
  await expectTarget(page.getByRole("button", { name: "Skopiuj ten tydzień na następny" }));
  await page.getByRole("button", { name: "Następny tydzień" }).click();
  await expectTarget(page.getByRole("button", { name: "Ten tydzień", exact: true }));
});

test("praca: zakładki działu i „Dodaj wpis” mają cele dotyku ≥ 44 px @mobile", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  for (const tab of ["Quiz", "Tablica", "Lista", "Dziennik"]) {
    await expectTarget(page.getByRole("tab", { name: tab }));
  }
  await expectTarget(page.getByRole("button", { name: "Dodaj wpis" }).first());
});
