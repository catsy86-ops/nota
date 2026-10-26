import { test, expect } from "@playwright/test";

// Egzamin próbny (P-3): 20 pytań, bez wyjaśnień w trakcie, z limitem 30 min, wynik po tematach.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("egzamin: 20 pytań bez podpowiedzi, wynik po tematach i zapis w ostatnich wynikach", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("start-exam").click();
  await expect(page.getByText("Pytanie 1 z 20")).toBeVisible();

  for (let i = 1; i <= 20; i++) {
    await page.getByRole("group", { name: "Odpowiedzi" }).getByRole("button").first().click();
    // W trakcie egzaminu nie ma informacji, czy odpowiedź była dobra.
    await expect(page.getByText("Dobrze. ")).toHaveCount(0);
    await expect(page.getByText("Nie tym razem. ")).toHaveCount(0);
    await page.getByRole("button", { name: i < 20 ? "Dalej" : "Zobacz wynik" }).click();
  }

  const result = page.getByRole("region", { name: "Wynik egzaminu" });
  await expect(result).toBeVisible();
  await expect(result).toContainText("/20");
  await expect(result).toContainText("Egzamin nie zmienia powtórek");
  await expect(page.getByRole("region", { name: "Wynik rundy" })).toHaveCount(0);

  await result.getByRole("button", { name: "Zakończ" }).click();
  await expect(page.getByTestId("last-exam")).toContainText("/20");
});

test("egzamin kończy się sam po 30 minutach, a nieodpowiedziane pytania liczą się jako błędne", async ({ page }) => {
  await page.clock.install();
  await page.clock.resume();
  await page.goto("/praca");
  await page.getByTestId("start-exam").click();
  await expect(page.getByText("Pytanie 1 z 20")).toBeVisible();
  await page.clock.fastForward(31 * 60_000);
  await expect(page.getByRole("region", { name: "Wynik egzaminu" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Wynik egzaminu" })).toContainText("0/20");
});

test("wynik egzaminu widać w statystykach Nauki", async ({ page }) => {
  await page.goto("/praca");
  await page.getByTestId("start-exam").click();
  for (let i = 1; i <= 20; i++) {
    await page.getByRole("group", { name: "Odpowiedzi" }).getByRole("button").first().click();
    await page.getByRole("button", { name: i < 20 ? "Dalej" : "Zobacz wynik" }).click();
  }
  await page.getByRole("button", { name: "Zakończ" }).click();
  await page.getByRole("button", { name: "Statystyki" }).first().click();
  await expect(page.getByTestId("stats-exams")).toContainText("/20");
});
