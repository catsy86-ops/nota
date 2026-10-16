import { test, expect, type Page } from "@playwright/test";

// „Jak rozwiązane?”: opis rozwiązania problemu, szukanie po nim i „Moje rozwiązania” przy temacie na tablicy.

async function reloadWhenSaved(page: Page) {
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "p", at: new Date(2026, 9, 14, 9).getTime(), kind: "problem", topic: "spadki", text: "Zaleganie wody w poziomie", site: "Lipowa 5", checked: [], images: [] },
        { id: "o", at: new Date(2026, 9, 14, 8).getTime(), kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("rozwiązany problem: opis rozwiązania, po przeładowaniu, szukanie i „Moje rozwiązania” przy temacie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const journal = page.getByTestId("study-journal");
  const problem = journal.locator("[data-journal-entry]").filter({ hasText: "Zaleganie wody w poziomie" });

  // Oznaczenie jako rozwiązany od razu otwiera pole „Jak rozwiązane?”.
  await problem.getByRole("button", { name: "Oznacz jako rozwiązany" }).click();
  const field = problem.getByRole("textbox", { name: "Jak rozwiązane?" });
  await expect(field).toBeFocused();
  await field.fill("Poprawiony spadek na 2%, przestawiona rewizja");
  await problem.getByRole("button", { name: "Zapisz" }).click();
  await expect(problem.getByTestId("journal-solution")).toContainText("Rozwiązanie: Poprawiony spadek na 2%, przestawiona rewizja");

  await reloadWhenSaved(page);
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const after = page.getByTestId("study-journal");
  await expect(after.getByTestId("journal-solution")).toContainText("przestawiona rewizja");

  // Szukanie obejmuje opis rozwiązania.
  await after.getByRole("searchbox", { name: "Szukaj w dzienniku" }).fill("rewizja");
  await expect(after.locator("[data-journal-entry]")).toHaveCount(1);

  // Tablica: przy temacie „Spadki kanalizacji” — „Moje rozwiązania (1)”.
  await page.getByRole("tab", { name: "Tablica" }).click();
  const topic = page.locator('[data-topic="spadki"]').first();
  const sols = topic.locator("[data-topic-solutions]");
  await sols.locator("summary").click();
  await expect(sols).toContainText("Moje rozwiązania (1)");
  await expect(sols).toContainText("Zaleganie wody w poziomie");
  await expect(sols).toContainText("→ Poprawiony spadek na 2%, przestawiona rewizja");
});

test("„Pomiń” zamyka pole bez opisu, a „Jak rozwiązane?” pozwala dopisać później", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const problem = page.getByTestId("study-journal").locator("[data-journal-entry]").filter({ hasText: "Zaleganie wody w poziomie" });
  await problem.getByRole("button", { name: "Oznacz jako rozwiązany" }).click();
  await problem.getByRole("button", { name: "Pomiń" }).click();
  await expect(problem.getByRole("textbox", { name: "Jak rozwiązane?" })).toHaveCount(0);
  await problem.getByRole("button", { name: "Jak rozwiązane?" }).click();
  await problem.getByRole("textbox", { name: "Jak rozwiązane?" }).fill("Nowa złączka");
  await problem.getByRole("textbox", { name: "Jak rozwiązane?" }).press("Enter");
  await expect(problem.getByTestId("journal-solution")).toContainText("Nowa złączka");
});
