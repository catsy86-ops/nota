import { test, expect } from "@playwright/test";

// Rozwiązany problem → szkic własnego pytania (Etap 4 § 4.2): pytanie i poprawna odpowiedź są wypełnione.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((now) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "p", at: now - 3600_000, kind: "problem", topic: null, text: "Przeciek na złączce", site: "Lipowa 5",
          resolved: now - 1800_000, solution: "Dokręcona tuleja, wymieniona uszczelka", checked: [], images: [] },
      ],
    }));
  }, NOW);
  await page.goto("/praca");
});

test("rozwiązany problem zamienia się w szkic pytania", async ({ page }) => {
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByRole("button", { name: "Zamień w pytanie" }).click();
  const dialog = page.getByTestId("custom-questions");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Pytanie", { exact: true })).toHaveValue("Przeciek na złączce");
  await expect(dialog.getByLabel("Poprawna odpowiedź")).toHaveValue("Dokręcona tuleja, wymieniona uszczelka");
  await expect(dialog.getByLabel("Błędna odpowiedź 1")).toHaveValue("");
});
