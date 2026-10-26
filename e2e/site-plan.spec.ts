import { test, expect } from "@playwright/test";

// P-5 (plan Pracy 2.6): „Plan na dziś” w karcie „Przed wejściem”: dodawanie, odhaczanie, zapis po przeładowaniu.
const NOW = new Date(2026, 9, 14, 8, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((now) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at: now - 3600_000, kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  }, NOW);
});

test("plan na dziś: dodaj zadanie, odhacz, zostaje po przeładowaniu", async ({ page }) => {
  await page.goto("/dzis");
  const plan = page.getByRole("region", { name: "Plan na dziś" });
  await expect(plan).toBeVisible();
  await plan.getByRole("textbox", { name: "Nowe zadanie na dziś" }).fill("Wymienić złączkę w piwnicy");
  await plan.getByRole("button", { name: "Dodaj" }).click();
  await expect(plan.getByText("Wymienić złączkę w piwnicy")).toBeVisible();
  await plan.getByRole("checkbox", { name: "Zrobione: Wymienić złączkę w piwnicy" }).check();
  await page.reload();
  await expect(page.getByRole("region", { name: "Plan na dziś" }).getByRole("checkbox", { name: "Zrobione: Wymienić złączkę w piwnicy" })).toBeChecked();
});
