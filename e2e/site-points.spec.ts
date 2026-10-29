import { test, expect, type Page } from "@playwright/test";

// Punkty w pomieszczeniach (H2.1, H2.2): szablon łazienki, kratki stanu, wysokość, nowy punkt,
// usunięcie z „Cofnij”, licznik w karcie i zapis po odświeżeniu; układ bez przewijania w bok.

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

async function openCard(page: Page) {
  await page.goto("/praca");
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  return page.getByTestId("site-card");
}

test("łazienka z szablonu, kratki stanu, wysokość, nowy punkt i licznik @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await openCard(page);
  const panel = card.getByTestId("site-points");
  await panel.getByRole("button", { name: /^\+ Łazienka/ }).click();
  await expect(panel.getByTestId("site-point")).toHaveCount(4);
  await expect(card.getByTestId("site-tally").getByRole("button", { name: "Punkty: 0 z 4 gotowe" })).toBeVisible();
  await expect(panel.getByLabel("Umywalka: wysokość w cm")).toHaveValue("58");
  await expect(panel.getByLabel("WC (stelaż): wysokość w cm")).toHaveValue("130");

  // Kratka „próba” zaznacza też „podejście”; „Cofnij” wraca do stanu sprzed.
  await panel.getByRole("checkbox", { name: "Umywalka: próba" }).click();
  await expect(panel.getByRole("checkbox", { name: "Umywalka: podejście" })).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByRole("checkbox", { name: "Umywalka: biały montaż" })).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(panel.getByRole("checkbox", { name: "Umywalka: podejście" })).toHaveAttribute("aria-checked", "false");

  await panel.getByRole("checkbox", { name: "Prysznic: biały montaż" }).click();
  await expect(card.getByTestId("site-tally").getByRole("button", { name: "Punkty: 1 z 4 gotowe" })).toBeVisible();
  await expect(panel.getByTestId("site-points-progress")).toHaveText("1/4 gotowe");

  const height = panel.getByLabel("Umywalka: wysokość w cm");
  await height.fill("60");
  await height.blur();
  await panel.getByLabel("Dodaj punkt: Łazienka").selectOption("odplyw-liniowy");
  await expect(panel.getByTestId("site-point")).toHaveCount(5);

  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
  const again = await openCard(page);
  const p2 = again.getByTestId("site-points");
  await expect(p2.getByTestId("site-point")).toHaveCount(5);
  await expect(p2.getByLabel("Umywalka: wysokość w cm")).toHaveValue("60");
  await expect(p2.getByRole("checkbox", { name: "Prysznic: biały montaż" })).toHaveAttribute("aria-checked", "true");
});

test("usunięcie pomieszczenia z „Cofnij”; własna nazwa; 320 px bez przewijania w bok @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  const card = await openCard(page);
  const panel = card.getByTestId("site-points");
  await panel.getByLabel("Nazwa pomieszczenia").fill("Kotłownia");
  await panel.getByRole("button", { name: "Dodaj", exact: true }).click();
  await expect(panel.getByText("Brak punktów — dodaj pierwszy poniżej.")).toBeVisible();
  await panel.getByLabel("Dodaj punkt: Kotłownia").selectOption("kociol");
  await panel.getByRole("button", { name: /^\+ Kuchnia/ }).click();
  await expect(panel.getByTestId("site-room")).toHaveCount(2);

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(wide, "przewijanie w bok przy 320 px").toBe(false);

  await panel.getByRole("button", { name: "Usuń pomieszczenie Kotłownia" }).click();
  await expect(panel.getByTestId("site-room")).toHaveCount(1);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(panel.getByTestId("site-room")).toHaveCount(2);
  await expect(panel.getByTestId("site-point")).toHaveCount(3);
});

// Jednopikselowy PNG — wystarczy, żeby `prepareImage` zapisał zdjęcie.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("zdjęcie punktu: wpis z podpisem i miniatura przy punkcie (H2.3) @mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const card = await openCard(page);
  const panel = card.getByTestId("site-points");
  await panel.getByRole("button", { name: /^\+ Łazienka/ }).click();

  const chooser = page.waitForEvent("filechooser");
  await panel.getByRole("button", { name: "Zdjęcie punktu: Umywalka" }).click();
  await (await chooser).setFiles({ name: "umywalka.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(page.getByText("Zdjęcie punktu: Łazienka · Umywalka · 58 cm")).toBeVisible();
  await expect(panel.getByRole("img", { name: "Ostatnie zdjęcie: Umywalka" })).toBeVisible();
  await expect(panel.getByRole("img", { name: "Ostatnie zdjęcie: Prysznic" })).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("study-journal").getByText("Punkt: Łazienka · Umywalka · 58 cm")).toBeVisible();
});
