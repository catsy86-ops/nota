import { test, expect } from "@playwright/test";

// Protokół odbioru z karty budowy: wydruk z danymi budowy, etapami, próbą szczelności, uwagami i podpisami.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 16, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    const w = window as unknown as Record<string, unknown>;
    // Zamiast okna drukowania: zapamiętaj, co poszłoby na papier.
    window.print = () => {
      w.__printed = document.documentElement.classList.contains("printing-report") ? document.getElementById("report-print")?.textContent : null;
    };
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const entry = (id: string, d: number, extra: Record<string, unknown>) => ({
      id, at: new Date(2026, 9, d, 9).getTime(), kind: "ok", topic: null, text: "Montaż", site: "Lipowa 5", checked: [], images: [], ...extra,
    });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        entry("a", 10, { text: "Próba pionów", test: { medium: "water", bar: 9, minutes: 30, drop: 0, ok: true } }),
        entry("b", 12, { kind: "problem", text: "Brak rewizji w łazience" }),
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("protokół odbioru: dane z karty, etap, próba szczelności, uwagi i podpisy na wydruku", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  // Wpisy z dwóch dni — nagłówek budowy jest w każdym dniu.
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).first().click();
  const card = page.getByTestId("site-card");

  await card.getByLabel("Adres").fill("ul. Lipowa 5, Kraków");
  await card.getByLabel("Inwestor").fill("Jan Kowalski");
  await card.getByRole("button", { name: "Zapisz kartę" }).click();
  await card.getByTestId("site-stages").getByRole("checkbox", { name: /Próba szczelności/ }).click();

  await card.getByRole("button", { name: "Protokół odbioru" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __printed?: string }).__printed)).toBeTruthy();
  const printed = await page.evaluate(() => (window as unknown as { __printed: string }).__printed);
  expect(printed).toContain("Protokół odbioru instalacji wodno-kanalizacyjnej");
  expect(printed).toContain("ul. Lipowa 5, Kraków");
  expect(printed).toContain("Jan Kowalski");
  expect(printed).toContain("Okres prac10–12 października 2026");
  expect(printed).toContain("Próba szczelności16.10.2026");
  expect(printed).toContain("Próba szczelności (woda, 9 bar, 30 min, spadek 0 bar): szczelna");
  expect(printed).toContain("Brak rewizji w łazience");
  expect(printed).toContain("Wykonawca — data i podpis");
  expect(printed).toContain("Inwestor — data i podpis");
});
