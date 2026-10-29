import { test, expect } from "@playwright/test";

// P5.3: na osi dziennika separator przy każdym tygodniu, z sumą godzin na budowach z Grafiku.
test("oś dziennika: separatory tygodni z sumą godzin", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (d: number, h: number) => new Date(2026, 9, d, h).getTime();
    const e = (id: string, when: number, text: string) => ({ id, at: when, kind: "ok", topic: null, text, site: "Lipowa 5", checked: [], images: [] });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({ journal: [e("a", at(14, 9), "Piony"), e("b", at(8, 9), "Podejścia")] }));
    localStorage.setItem("kaczy:shifts", JSON.stringify({ version: 2, days: { "2026-10-14": { type: "b" } } }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  const weeks = page.getByTestId("study-journal").locator("[data-journal-week]");
  await expect(weeks).toHaveCount(2);
  await expect(weeks.first()).toContainText("Tydz. 42");
  await expect(weeks.first()).toContainText("10 h");
  await expect(weeks.nth(1)).toContainText("Tydz. 41");
  // Komentarz z kodu nie może trafić na ekran jako tekst (błąd z P5.3).
  await expect(page.getByTestId("study-journal")).not.toContainText("content-visibility");
});
