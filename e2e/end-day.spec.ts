import { test, expect } from "@playwright/test";

// „Zakończ dzień” (B2.4): jeden arkusz w 4 krokach — godziny, raport, braki do hurtowni, kopia.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 18, 30).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [
        { id: "a", at: new Date(2026, 9, 14, 7, 40).getTime(), kind: "ok", topic: null, text: "Podejścia w łazience", site: "Lipowa 5", checked: [], images: [] },
        { id: "b", at: new Date(2026, 9, 14, 15, 10).getTime(), kind: "ok", topic: null, text: "Pion kanalizacji", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("cztery kroki: podpowiedź godzin, raport z dzisiaj, brak zamówienia, kopia; Wstecz i Pomiń", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("end-day-open").click();
  const sheet = page.getByTestId("end-day");
  await expect(sheet.getByTestId("end-day-step")).toContainText("krok 1 z 4");
  await expect(sheet.getByTestId("end-day-text")).toContainText("Pierwszy wpis 07:40, ostatni 15:10");
  await expect(sheet.getByTestId("end-day-text")).toContainText("7 h 30 min");

  // Godziny: otwiera okno z godzinami tego dnia nad arkuszem.
  await sheet.getByRole("button", { name: "Wpisz godziny" }).click();
  const hours = page.getByTestId("day-hours");
  await expect(hours).toBeVisible();
  await hours.getByRole("button", { name: "Zapisz" }).click();
  await expect(hours).toHaveCount(0);

  await sheet.getByRole("button", { name: "Dalej" }).click();
  await expect(sheet.getByTestId("end-day-step")).toContainText("krok 2 z 4");
  await expect(sheet.getByTestId("end-day-text")).toContainText("2 wpisy");

  await sheet.getByRole("button", { name: "Dalej" }).click();
  await expect(sheet.getByTestId("end-day-text")).toContainText("Nic do zamówienia");

  await sheet.getByRole("button", { name: "Dalej" }).click();
  await expect(sheet.getByTestId("end-day-step")).toContainText("krok 4 z 4");
  await expect(sheet.getByRole("button", { name: "Zrób kopię" })).toBeVisible();

  await sheet.getByRole("button", { name: "Wstecz" }).click();
  await expect(sheet.getByTestId("end-day-step")).toContainText("krok 3 z 4");
  await sheet.getByRole("button", { name: "Dalej" }).click();
  await sheet.getByRole("button", { name: "Gotowe" }).click();
  await expect(sheet).toHaveCount(0);
});

test("adres /praca?raport=koniec otwiera arkusz i znika z paska adresu", async ({ page }) => {
  await page.goto("/praca?raport=koniec");
  await expect(page.getByTestId("end-day")).toBeVisible();
  await expect(page).not.toHaveURL(/raport=/);
});
