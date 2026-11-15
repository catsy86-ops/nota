import { test, expect } from "@playwright/test";

// Powtórki z działu Praca na stronie „Dziś”: karta tylko przy pytaniach na dziś, „Powtórz” → quiz „Na dziś”.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "quiz");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("„Dziś”: karta powtórek następnego dnia po rundzie, „Powtórz” otwiera quiz „Na dziś”", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.goto("/praca");
  await page.getByRole("button", { name: "Zacznij rundę" }).click();
  for (let i = 1; i <= 10; i++) {
    await page.getByRole("group", { name: "Odpowiedzi" }).getByRole("button").first().click();
    await page.getByRole("button", { name: i < 10 ? "Dalej" : "Zobacz wynik" }).click();
  }
  const resultRegion = page.getByRole("region", { name: "Wynik rundy" });
  await expect(resultRegion).toBeVisible();
  // Powtórki na FSRS: dobra odpowiedź odsuwa pytanie o kilka dni, więc następnego dnia czekają tylko pomyłki.
  const correct = Number(/^(\d+)\s*\/\s*10/.exec((await resultRegion.locator("p").first().innerText()).trim())?.[1]);
  const wrong = 10 - correct;
  expect(wrong, "pierwsza odpowiedź w każdym pytaniu: co najmniej jedna pomyłka, żeby było co powtarzać").toBeGreaterThan(0);
  await expect(page.getByText("Zapisano", { exact: true })).toBeVisible();

  // Tego samego dnia nic nie czeka — karty nie ma.
  await page.goto("/dzis");
  await expect(page.getByTestId("today-card")).toBeVisible();
  await expect(page.getByTestId("today-study")).toHaveCount(0);

  // Następny dzień: do powtórki wracają pomyłki z rundy.
  await page.clock.setFixedTime(new Date(2026, 9, 15, 9, 0).getTime());
  await page.reload();
  const card = page.getByTestId("today-study");
  await expect(card.getByTestId("today-study-count")).toHaveText(String(wrong));
  await card.getByRole("button", { name: "Powtórz" }).click();

  await expect(page).toHaveURL(/\/praca$/);
  await expect(page.getByText(`Pytanie 1 z ${wrong}`)).toBeVisible();
  await expect(page.getByText(/^Na dziś · /)).toBeVisible();
});
