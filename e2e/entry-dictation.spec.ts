import { test, expect } from "@playwright/test";

// Cały wpis jedną wypowiedzią: budowa, rodzaj, tekst i kształtki z jednego dyktowania (udawane Web Speech API).

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    localStorage.setItem("kaczy.dictation.consent", "1");
    const w = window as unknown as Record<string, unknown>;
    w.__speech = ["lipowa problem przeciek przy trójniku kolano 16 cztery sztuki"];
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const text = (w.__speech as string[]).shift() ?? "";
        setTimeout(() => {
          this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: text } }] });
          this.onend?.();
        }, 50);
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const entry = (id: string, h: number, site: string) => ({ id, at: new Date(2026, 9, 13, h).getTime(), kind: "ok", topic: null, text: "Wczoraj", site, checked: [], images: [] });
    // Bieżąca budowa to Polna 2 — dyktowanie ma ją zmienić na Lipowa 5.
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Polna 2", journal: [entry("a", 8, "Lipowa 5"), entry("b", 9, "Polna 2")] }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("jedna wypowiedź ustawia budowę, rodzaj, tekst i kształtki, a wpis zapisuje się na właściwej budowie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("button", { name: "Budowa: Polna 2. Zmień" })).toBeVisible();

  await sheet.getByRole("button", { name: "Dyktuj", exact: true }).click();
  await expect(sheet.getByRole("button", { name: "Budowa: Lipowa 5. Zmień" })).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "Problem" })).toHaveAttribute("aria-checked", "true");
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("przeciek przy trójniku");
  await expect(sheet.getByTestId("fittings").getByLabel("Kształtka 1: nazwa")).toHaveValue("Kolano 16");
  await expect(sheet.getByTestId("fittings").getByTestId("fitting-qty")).toHaveText(["4"]);
  await expect(page.getByText("Z wypowiedzi: budowa Lipowa 5 · Problem · kształtki: Kolano 16 × 4")).toBeVisible();

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  const newest = page.locator("[data-journal-entry]").filter({ hasText: "przeciek przy trójniku" });
  await expect(newest).toHaveCount(1);
  await expect(newest.getByTestId("journal-fittings")).toHaveText("Kolano 16 × 4");
  // Wpis należy do budowy Lipowa 5: filtr tej budowy go pokazuje, filtr Polnej 2 — nie.
  const journal = page.getByTestId("study-journal");
  const sites = journal.getByRole("group", { name: "Budowa" });
  await sites.getByRole("button", { name: "Lipowa 5" }).click();
  await expect(journal.locator("[data-journal-entry]").filter({ hasText: "przeciek przy trójniku" })).toHaveCount(1);
  await sites.getByRole("button", { name: "Polna 2" }).click();
  await expect(journal.locator("[data-journal-entry]").filter({ hasText: "przeciek przy trójniku" })).toHaveCount(0);
});

test("„brakuje …” w dyktowaniu dopisuje braki do karty budowy, a nie do wpisu", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__speech = ["lipowa brakuje kleju do PCV i rury PEX 16 pięćdziesiąt metrów"];
  });
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("button", { name: "Dyktuj", exact: true }).click();
  await expect(page.getByText("Z wypowiedzi: budowa Lipowa 5 · braki (Lipowa 5): Klej do PCV, Rura PEX 16 50 m")).toBeVisible();
  // Treść wpisu pusta — braki nie trafiły do tekstu.
  await expect(sheet.getByLabel("Co się dzieje?")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const panel = page.getByTestId("site-card").getByTestId("site-shortages");
  await expect(panel.locator("[data-shortage-status]")).toHaveCount(2);
  await expect(panel).toContainText("Klej do PCV");
  await expect(panel).toContainText("Rura PEX 16 · 50 m");
  await expect(panel.getByRole("button", { name: "Rura PEX 16: Brakuje. Zmień status" })).toBeVisible();
});
