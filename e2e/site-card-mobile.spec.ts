import { test, expect, type Locator, type Page } from "@playwright/test";

// Karta budowy na telefonie: etapy, „Do zamówienia”, braki i przyciski protokołu mieszczą się w 320/390 px,
// a nowe przyciski mają cel dotyku ≥ 44 px.

test.use({ isMobile: true, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Osiedle Słoneczne, dom nr 12",
      journal: [{
        id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Osiedle Słoneczne, dom nr 12",
        checked: [], images: [], fittings: [{ name: "Kolano naścienne 16", qty: 12 }, { name: "Redukcja 20/16", qty: 3 }],
      }],
    }));
  });
});

/** Elementy karty wystające poza prawą krawędź ekranu (poza przewijanymi w bok kontenerami). */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const card = document.querySelector('[data-testid="site-card"]');
    if (!card) return ["(brak karty)"];
    return Array.from(card.querySelectorAll<HTMLElement>("*"))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) return false;
        for (let p = el.parentElement; p && p !== card; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()} „${(el.textContent ?? "").trim().slice(0, 30)}”`);
  });
}

async function expectTarget(el: Locator, name: string) {
  await el.scrollIntoViewIfNeeded();
  await expect(el, name).toBeVisible();
  const box = (await el.boundingBox())!;
  expect(Math.round(box.height), `${name}: wysokość celu`).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.width), `${name}: szerokość celu`).toBeGreaterThanOrEqual(44);
}

for (const width of [320, 390]) {
  test(`${width} px: karta budowy z etapami, zamówieniem i brakami bez przewijania w bok @mobile`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/praca");
    await page.getByRole("tab", { name: "Dziennik" }).click();
    await page.getByTestId("study-journal").getByRole("button", { name: "Osiedle Słoneczne, dom nr 12: karta budowy" }).click();
    const card = page.getByTestId("site-card");

    const stages = card.getByTestId("site-stages");
    await stages.getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ }).click();
    const shortages = card.getByTestId("site-shortages");
    await shortages.getByLabel("Czego brakuje").fill("Rura PEX 16 w otulinie czerwonej, zwój");
    await shortages.getByLabel("Ile").fill("200 m");
    await shortages.getByRole("button", { name: "Dodaj brak" }).click();
    await expect(shortages.locator("[data-shortage-status]")).toHaveCount(1);

    expect(await overflowing(page), `${width} px: wystaje poza ekran`).toEqual([]);

    await expectTarget(stages.getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ }), "etap");
    await expectTarget(stages.getByRole("button", { name: "Usuń etap: Odbiór" }), "usuń etap");
    await expectTarget(card.getByTestId("site-order").getByRole("button", { name: "Oznacz jako zamówione" }), "oznacz jako zamówione");
    await expectTarget(shortages.getByRole("button", { name: /Zmień status/ }), "status braku");
    await expectTarget(shortages.getByRole("button", { name: "Dodaj brak" }), "dodaj brak");
    await expectTarget(card.getByRole("button", { name: "Protokół odbioru" }), "protokół odbioru");
    await expectTarget(card.getByRole("button", { name: "Tekst protokołu" }), "tekst protokołu");
  });
}

// Jednopikselowy PNG — wystarczy, żeby `prepareImage` zapisał zdjęcie.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test("390 px: „Zdjęcie do wpisu” w karcie budowy dodaje wpis ze zdjęciem, cel dotyku ≥ 44 px (B2)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Osiedle Słoneczne, dom nr 12: karta budowy" }).click();
  const card = page.getByTestId("site-card");

  await expectTarget(card.getByRole("button", { name: "Zdjęcie do wpisu" }), "zdjęcie do wpisu");
  await card.locator('input[type="file"][capture]:not([data-testid="point-photo-input"])').setInputFiles({ name: "zdjecie.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(page.getByText("Zdjęcie dodane jako wpis budowy")).toBeVisible();
});
