import { test, expect, type Page } from "@playwright/test";

// Sposób rozliczenia budowy (H3.1): godziny, od punktu (domyślna i na typ punktu), ryczałt za całość
// i za etapy; linia w nagłówku panelu, zapis po odświeżeniu, zła kwota wraca; 320 px bez przewijania w bok.

test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 21, 9).getTime(), kind: "ok", topic: null, text: "Start", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
});

async function openBilling(page: Page) {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");
  const panel = card.getByTestId("site-billing");
  await panel.getByRole("button", { name: /^Rozliczenie/ }).click();
  return { card, panel };
}

async function amount(panel: ReturnType<Page["getByTestId"]>, label: string, value: string) {
  const input = panel.getByLabel(label, { exact: true });
  await input.fill(value);
  await input.press("Enter");
}

test("od punktu z wyższą stawką WC i ryczałt za etapy; zapis po odświeżeniu @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { card, panel } = await openBilling(page);
  await expect(panel.getByRole("button", { name: "Godziny", exact: true })).toHaveAttribute("aria-pressed", "true");
  await card.getByTestId("site-points").getByRole("button", { name: /^\+ Łazienka/ }).click();

  await panel.getByRole("button", { name: "Od punktu", exact: true }).click();
  await amount(panel, "Za punkt (domyślnie) (zł)", "150");
  await expect(panel.getByLabel("WC (stelaż) ×1 (zł)")).toHaveAttribute("placeholder", "150");
  await amount(panel, "WC (stelaż) ×1 (zł)", "250");

  await panel.getByRole("button", { name: "Godziny", exact: true }).click();
  await panel.getByRole("button", { name: "Ryczałt", exact: true }).click();
  await amount(panel, "Rozprowadzenie wody (zł)", "2 000");
  await amount(panel, "Próba szczelności (zł)", "1500,5");
  await expect(panel.getByTestId("billing-stages-total")).toHaveText("Etapy razem: 3500,50 zł");
  await expect(panel.getByTestId("site-billing-summary")).toHaveText("Od punktu 150 zł · Ryczałt 3500,50 zł");

  // Zła kwota wraca do poprzedniej i mówi, co wpisać.
  await amount(panel, "Za punkt (domyślnie) (zł)", "sto");
  await expect(page.getByText("Za punkt (domyślnie): wpisz kwotę, np. 150 albo 1250,50")).toBeVisible();
  await expect(panel.getByLabel("Za punkt (domyślnie) (zł)")).toHaveValue("150");

  await page.reload();
  const again = await openBilling(page);
  await expect(again.panel.getByTestId("site-billing-summary")).toHaveText("Od punktu 150 zł · Ryczałt 3500,50 zł");
  await expect(again.panel.getByLabel("WC (stelaż) ×1 (zł)")).toHaveValue("250");
  await expect(again.panel.getByLabel("Rozprowadzenie wody (zł)")).toHaveValue("2000");
  await expect(again.panel.getByRole("button", { name: "Godziny", exact: true })).toHaveAttribute("aria-pressed", "false");
});

test("stawka godzinowa z panelu rozliczenia; 320 px bez przewijania w bok @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const { panel } = await openBilling(page);
  await amount(panel, "Stawka godzinowa (zł/h)", "45");
  await expect(panel.getByTestId("site-billing-summary")).toHaveText("Godziny 45 zł/h");
  await panel.getByRole("button", { name: "Od punktu", exact: true }).click();
  await panel.getByRole("button", { name: "Ryczałt", exact: true }).click();
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide, "przewijanie w bok przy 320 px").toBe(false);
});

test("należności (H3.2): ryczałt i odhaczony etap, zaliczka, zostało, cofnięcie usunięcia, tekst @mobile", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  const { card, panel } = await openBilling(page);
  const dues = panel.getByTestId("billing-dues");
  await expect(dues.getByText("Nic jeszcze nie naliczone")).toBeVisible();

  await panel.getByRole("button", { name: "Ryczałt", exact: true }).click();
  await amount(panel, "Za całą budowę (zł)", "8000");
  await amount(panel, "Rozprowadzenie wody (zł)", "1500");
  await expect(dues.getByTestId("billing-accrued")).toHaveText("8000 zł");
  await card.getByTestId("site-stages").getByRole("checkbox", { name: /Rozprowadzenie wody/ }).click();
  await expect(dues.getByTestId("billing-accrued")).toHaveText("9500 zł");

  await dues.getByRole("button", { name: "Wpłata (zaliczka)" }).click();
  await dues.getByLabel("Kwota wpłaty (zł)").fill("3 000");
  await dues.getByLabel("Notatka do wpłaty").fill("zaliczka gotówką");
  await dues.getByRole("button", { name: "Zapisz wpłatę" }).click();
  await expect(dues.getByTestId("billing-due")).toHaveText(/Zostało do zapłaty\s*6500 zł/);

  await dues.getByRole("button", { name: "Usuń wpłatę 3000 zł z 22.10.2026" }).click();
  await expect(dues.getByTestId("billing-due")).toHaveText(/9500 zł/);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(dues.getByTestId("billing-due")).toHaveText(/6500 zł/);

  // Bez Web Share tekst idzie do schowka.
  await page.evaluate(() => { Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); });
  await dues.getByRole("button", { name: "Tekst" }).click();
  await expect(page.getByText("Skopiowano — wklej szefowi na WhatsAppie")).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("*Zostało do zapłaty: 6500 zł*");
  expect(text).toContain("• 22.10.2026: 3000 zł (zaliczka gotówką)");

  await page.reload();
  const again = await openBilling(page);
  await expect(again.panel.getByTestId("billing-due")).toHaveText(/6500 zł/);
});

test("miesiąc razem (H3.3): gotowy punkt ze stawką widać w podsumowaniu Grafiku jako „Z budów” @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { card, panel } = await openBilling(page);
  await card.getByTestId("site-points").getByRole("button", { name: /^\+ Łazienka/ }).click();
  await panel.getByRole("button", { name: "Od punktu", exact: true }).click();
  await amount(panel, "Za punkt (domyślnie) (zł)", "150");
  await amount(panel, "WC (stelaż) ×1 (zł)", "250");
  const points = card.getByTestId("site-points");
  await points.getByRole("checkbox", { name: "Umywalka: biały montaż" }).click();
  await points.getByRole("checkbox", { name: "WC (stelaż): biały montaż" }).click();
  await expect(panel.getByTestId("billing-accrued")).toHaveText("400 zł");

  await page.goto("/grafik");
  const line = page.getByTestId("site-month-earnings");
  await expect(line.getByTestId("site-month-total")).toHaveText("400 zł");
  await line.locator("summary").click();
  await expect(line).toContainText("Lipowa 5 2 punkty");
  await expect(line.getByTestId("site-month-grand")).toHaveText("400 zł");
});
