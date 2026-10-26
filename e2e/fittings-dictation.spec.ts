import { test, expect } from "@playwright/test";

// Dyktowanie kształtek: udawane Web Speech API zwraca gotowy tekst, parser robi z niego pozycje.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    localStorage.setItem("kaczy.dictation.consent", "1");
    const w = window as unknown as Record<string, unknown>;
    // Kolejne „wypowiedzi” z kolejki; każde start() oddaje jedną i kończy nasłuch.
    w.__speech = ["kolano szesnaście cztery sztuki, trójnik 16 dwa", "kolano 16 jedna sztuka"];
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        const queue = w.__speech as string[];
        const text = queue.shift() ?? "";
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
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ site: "Lipowa 5", journal: [] }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("dyktowanie kształtek: kilka pozycji naraz, powtórzona nazwa sumuje sztuki, zapis do wpisu", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  // Sekcja kształtek jest zwinięta, dopóki jej nie otworzyć (Etap 3 Praca).
  await sheet.getByRole("button", { name: /^(\+ |✓ )?Kształtki$/ }).click();

  // Pusta lista: mikrofon obok „Dodaj kształtki”.
  await sheet.getByRole("button", { name: "Dyktuj kształtki" }).click();
  const box = sheet.getByTestId("fittings");
  await expect(box.getByLabel("Kształtka 1: nazwa")).toHaveValue("Kolano 16");
  await expect(box.getByLabel("Kształtka 2: nazwa")).toHaveValue("Trójnik 16");
  await expect(box.getByTestId("fitting-qty")).toHaveText(["4", "2"]);
  await expect(page.getByText("Dodano: Kolano 16 × 4, Trójnik 16 × 2")).toBeVisible();

  // Druga wypowiedź: ta sama nazwa dokłada sztukę zamiast nowego wiersza.
  await box.getByRole("button", { name: "Dyktuj kształtki" }).click();
  await expect(box.getByTestId("fitting-qty")).toHaveText(["5", "2"]);

  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("journal-fittings").first()).toHaveText("Kolano 16 × 5, Trójnik 16 × 2");
});
