import { test, expect, type Locator, type Page } from "@playwright/test";

// Dzień hydraulika (plan H0.3): codzienna ścieżka w Pracy na telefonie, od wejścia na budowę po raport do szefa.
// Każdy krok zaczyna się w Dzienniku i liczy stuknięcia (kliknięcie albo wybór zdjęcia; pisanie się nie liczy).
// Cel planu to ≤ 3 stuknięcia na krok. `LIMIT` to stan dzisiejszy — test pilnuje, żeby nie było gorzej;
// kroki powyżej celu są w `opis.md` jako lista do poprawy. Wynik: adnotacje testu „stuknięcia”.

test.use({ isMobile: true, hasTouch: true });

const SITE = "Lipowa 5";
const GOAL = 3;
// Jednopikselowy PNG — wystarczy, żeby `prepareImage` zapisał zdjęcie.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 7, 12).getTime());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((site) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    w.open = (url: string) => { w.__opened = url; return null; };
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site,
      journal: [{
        id: "wczoraj", at: new Date(2026, 9, 21, 9).getTime(), kind: "ok", topic: null, text: "Podejścia w łazience", site,
        checked: [], images: [], fittings: [{ name: "Kolano 16", qty: 4 }],
      }],
    }));
  }, SITE);
});

test("dzień hydraulika: wejście, zdjęcie, kształtki, brak, etap, godziny, raport — stuknięcia na krok @mobile", async ({ page }) => {
  test.setTimeout(120_000);
  let taps = 0;
  const tap = async (el: Locator) => { await el.click(); taps++; };
  const results: string[] = [];

  /** Krok z Dziennika: liczy stuknięcia, sprawdza limit i wraca do Dziennika. */
  async function step(name: string, limit: number, run: () => Promise<void>) {
    taps = 0;
    await run();
    results.push(`${name}: ${taps}${taps > GOAL ? ` (cel ${GOAL})` : ""}`);
    expect(taps, `${name}: stuknięcia`).toBeLessThanOrEqual(limit);
    await closeOverlays(page);
  }

  await page.goto("/praca");
  const journal = page.getByTestId("study-journal");
  await expect(journal).toBeVisible();
  const openCard = async () => {
    await tap(journal.getByRole("button", { name: `${SITE}: karta budowy` }).first());
    const card = page.getByTestId("site-card");
    await expect(card).toBeVisible();
    return card;
  };

  // Jednorazowa konfiguracja (nie codzienna czynność): szef jako odbiorca raportu.
  await journal.getByRole("button", { name: "Raport" }).click();
  const form = page.getByRole("form", { name: "Odbiorcy raportu w WhatsApp" });
  await page.getByTestId("journal-report").getByRole("button", { name: "WhatsApp: dodaj szefa lub grupę" }).click();
  await form.getByLabel("Imię").fill("Marek");
  await form.getByLabel("Numer WhatsApp").fill("600 100 200");
  await form.getByRole("button", { name: "Zapisz" }).click();
  await expect(form).toHaveCount(0);
  await closeOverlays(page);

  await step("wejście na budowę", 2, async () => {
    const check = page.getByTestId("entry-check");
    await tap(check.getByRole("button", { name: "Sprawdź listę" }));
    await tap(page.getByTestId("entry-check-dialog").getByTestId("entry-check-enter"));
    await expect(check.getByTestId("entry-check-stamp")).toHaveText("Wejście 07:12");
  });

  await step("zdjęcie do wpisu", 2, async () => {
    const card = await openCard();
    await card.locator('input[type="file"][capture]:not([data-testid="point-photo-input"])').setInputFiles({ name: "zdjecie.png", mimeType: "image/png", buffer: Buffer.from(PNG_B64, "base64") });
    taps++;
    await expect(page.getByText("Zdjęcie dodane jako wpis budowy")).toBeVisible();
  });

  await step("wpis z kształtkami", 4, async () => {
    await tap(page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }));
    const sheet = page.getByTestId("journal-entry-sheet");
    await tap(sheet.getByRole("button", { name: /^(\+ |✓ )?Kształtki$/ }));
    await tap(sheet.getByTestId("fittings").getByRole("button", { name: "Kolano 16" }));
    await tap(sheet.getByRole("button", { name: "Zapisz wpis" }));
    await expect(sheet).toHaveCount(0);
    await expect(journal.getByTestId("journal-fittings").first()).toHaveText("Kolano 16 × 1");
  });

  await step("brak materiału", 2, async () => {
    const card = await openCard();
    const shortages = card.getByTestId("site-shortages");
    await shortages.getByLabel("Czego brakuje").fill("Rura PEX 16×2");
    await shortages.getByLabel("Ile").fill("50 m");
    await tap(shortages.getByRole("button", { name: "Dodaj brak" }));
    await expect(shortages.locator("[data-shortage-status]")).toHaveCount(1);
  });

  await step("odhaczony etap", 2, async () => {
    const card = await openCard();
    const stage = card.getByTestId("site-stages").getByRole("checkbox", { name: /Kanalizacja podposadzkowa/ });
    await tap(stage);
    await expect(stage).toHaveAttribute("aria-checked", "true");
  });

  await step("godziny dnia", 3, async () => {
    const card = await openCard();
    await tap(card.getByRole("button", { name: "Wpisz godziny" }));
    const dialog = page.getByRole("dialog", { name: /Godziny/ });
    await dialog.getByLabel(`Godziny: ${SITE}`).fill("8");
    await tap(dialog.getByRole("button", { name: "Zapisz" }));
    await expect(dialog).toHaveCount(0);
  });

  await step("raport do szefa", 2, async () => {
    await tap(journal.getByRole("button", { name: "Raport" }));
    await tap(page.getByTestId("journal-report").getByRole("button", { name: "Szefowi (Marek)" }));
    const opened = await page.evaluate(() => (window as unknown as { __opened: string }).__opened);
    const text = decodeURIComponent(opened.split("?text=")[1]);
    expect(text).toContain(`*Raport: ${SITE}`);
    expect(text).toContain("Kolano 16");
  });

  test.info().annotations.push({ type: "stuknięcia", description: results.join(" · ") });
});

/** Zamyka otwarte okna i arkusze (Escape się nie liczy — to powrót, nie czynność). */
async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    if (await page.locator('[role="dialog"][data-state="open"]').count() === 0) return;
    await page.keyboard.press("Escape");
  }
  await expect(page.locator('[role="dialog"][data-state="open"]')).toHaveCount(0);
}
