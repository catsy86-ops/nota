import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Zakładka „Budowa” (plan Pracy na budowie, B2.1): bieżąca budowa, trzy duże przyciski, plan i braki.
test.use({ isMobile: true, hasTouch: true });

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: Date.now() - 86_400_000, kind: "ok", topic: null, text: "Podejścia w łazience", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: Date.now() - 5 * 86_400_000, kind: "ok", topic: null, text: "Pion", site: "Polna 2", checked: [], images: [] },
      ],
    }));
  });
});

test("telefon bez zapisu zaczyna od Budowy; zdjęcie, brak i przejście do karty @mobile", async ({ page }) => {
  await page.goto("/praca");
  const home = page.getByTestId("site-home");
  await expect(home).toBeVisible();
  await expect(page.getByRole("tab", { name: "Budowa" })).toHaveAttribute("data-state", "active");
  // Bieżąca budowa arkusza wygrywa z kolejnością w pigułkach.
  await expect(page.getByTestId("site-home-card")).toContainText("Lipowa 5");
  await expect(page.getByRole("group", { name: "Budowa" }).getByRole("button", { name: "Lipowa 5" })).toHaveAttribute("aria-pressed", "true");

  // Zdjęcie: jeden wybór pliku = nowy wpis tej budowy, bez opuszczania ekranu.
  await page.getByTestId("site-home-photo-input").setInputFiles({ name: "z.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
  await expect(page.getByText("Dodano zdjęcie do budowy „Lipowa 5”")).toBeVisible();
  await expect(home).toBeVisible();

  // Brak: panel pojawia się i ma fokus w polu „Czego brakuje”.
  await page.getByTestId("site-home-shortage").click();
  const shortages = home.getByTestId("site-shortages");
  await expect(shortages.getByLabel("Czego brakuje")).toBeFocused();
  await shortages.getByLabel("Czego brakuje").fill("Rura PEX 16×2");
  await shortages.getByRole("button", { name: "Dodaj brak" }).click();
  await expect(shortages.locator("[data-shortage-status]")).toHaveCount(1);
  await expect(page.getByTestId("site-home-card")).toContainText("Braki 1");

  // Inna budowa z pigułek.
  await page.getByRole("group", { name: "Budowa" }).getByRole("button", { name: "Polna 2" }).click();
  await expect(page.getByTestId("site-home-card")).toContainText("Polna 2");

  // Karta budowy otwiera się w Dzienniku.
  await page.getByTestId("site-home-card").click();
  await expect(page.getByTestId("site-card")).toBeVisible();
  await expect(page.getByTestId("site-card")).toContainText("Polna 2");
});

test("Nauka grupuje Quiz, Tablicę i Listę, a powrót wraca do ostatniej podzakładki @mobile", async ({ page }) => {
  await page.goto("/praca");
  await expect(page.getByRole("tab", { name: "Quiz" })).toBeHidden();
  await page.getByRole("tab", { name: "Nauka" }).click();
  await page.getByRole("tab", { name: "Tablica" }).click();
  await expect(page.getByRole("tab", { name: "Tablica" })).toHaveAttribute("data-state", "active");
  await page.getByRole("tab", { name: "Budowa" }).click();
  await expect(page.getByTestId("site-home")).toBeVisible();
  await page.getByRole("tab", { name: "Nauka" }).click();
  await expect(page.getByRole("tab", { name: "Tablica" })).toHaveAttribute("data-state", "active");
});

test("bez żadnej budowy: pusty stan z przejściem do Dziennika @mobile", async ({ page }) => {
  await page.addInitScript(() => { localStorage.removeItem("kaczy.study.v1"); sessionStorage.setItem("seeded", "1"); });
  await page.goto("/praca");
  await expect(page.getByTestId("site-home-empty")).toBeVisible();
  await page.getByRole("button", { name: "Otwórz Dziennik" }).click();
  await expect(page.getByTestId("study-journal")).toBeVisible();
});

test("Budowa z danymi nie ma naruszeń dostępności (WCAG 2.2 AA) @mobile", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("site-home-shortage").click();
  await expect(page.getByTestId("site-shortages")).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});

// R4.1 (decyzja PR-3): tryb jednej ręki jest domyślnie wyłączony; po 5 wpisach pada jedna propozycja.
test("jedna ręka: propozycja po wpisach, układ pod kciuk i cele 56 px @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.study.usage.v1", JSON.stringify({ wpis: { n: 5, last: Date.now() } }));
  });
  await page.goto("/praca");
  const home = page.getByTestId("site-home");
  await expect(home).toBeVisible();
  // Wyłączony: akcje nad planem, nie pod nim.
  await expect(home).not.toHaveAttribute("data-one-hand", /.*/);
  const photo = page.getByTestId("site-home-photo");
  const card = page.getByTestId("site-home-card");
  expect((await card.boundingBox())!.y).toBeLessThan((await photo.boundingBox())!.y);

  const offer = page.getByTestId("one-hand-offer");
  await expect(offer).toBeVisible();
  await offer.getByRole("button", { name: "Włącz" }).click();
  await expect(offer).toHaveCount(0);
  await expect(home).toHaveAttribute("data-one-hand", "true");

  // Włączony: akcje pod informacjami (bliżej kciuka), karta i akcje mają co najmniej 56 px.
  const plan = home.getByTestId("site-plan");
  if (await plan.count()) expect((await plan.first().boundingBox())!.y).toBeLessThan((await card.boundingBox())!.y);
  expect((await card.boundingBox())!.y).toBeLessThan((await photo.boundingBox())!.y);
  for (const el of [card, photo, page.getByTestId("site-home-voice"), page.getByTestId("site-home-shortage")]) {
    expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  }

  // Wybór zostaje po przeładowaniu i nie wraca propozycja.
  await page.reload();
  await expect(page.getByTestId("site-home")).toHaveAttribute("data-one-hand", "true");
  await expect(page.getByTestId("one-hand-offer")).toHaveCount(0);
});

test("jedna ręka: „Nie, dziękuję” zostawia układ i nie pyta ponownie @mobile", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.study.usage.v1", JSON.stringify({ wpis: { n: 9, last: Date.now() } }));
  });
  await page.goto("/praca");
  await page.getByTestId("one-hand-offer").getByRole("button", { name: "Nie, dziękuję" }).click();
  await expect(page.getByTestId("one-hand-offer")).toHaveCount(0);
  await expect(page.getByTestId("site-home")).not.toHaveAttribute("data-one-hand", /.*/);
  await page.reload();
  await expect(page.getByTestId("site-home")).toBeVisible();
  await expect(page.getByTestId("one-hand-offer")).toHaveCount(0);
});

