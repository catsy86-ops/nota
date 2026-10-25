import { test, expect } from "@playwright/test";

// Odbiorcy raportu w karcie budowy (1.11 planu Praca 2026-10-24): wiersz „Odbiorcy raportu”
// rozwija ten sam formularz co okno raportu; zapis przeżywa odświeżenie.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (h: number) => new Date(2026, 9, 14, h).getTime();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at: at(8), kind: "ok", topic: null, text: "Próba szczelności pionu", site: "Lipowa 5", checked: [], images: [] },
      ],
    }));
  });
});

test("karta budowy: odbiorcy raportu — rozwinięcie, walidacja, zapis i przeżycie odświeżenia", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();

  const row = page.getByTestId("site-recipients");
  const toggle = row.getByRole("button", { name: /Odbiorcy raportu/ });
  await expect(toggle).toContainText("nie ustawieni");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  const form = row.getByRole("form", { name: "Odbiorcy raportu w WhatsApp" });
  await form.getByLabel("Imię").fill("Marek");
  await form.getByLabel("Numer WhatsApp").fill("12");
  await form.getByRole("button", { name: "Zapisz" }).click();
  await expect(form.getByLabel("Numer WhatsApp")).toHaveAttribute("aria-invalid", "true");

  await form.getByLabel("Numer WhatsApp").fill("600 100 200");
  await form.getByLabel("Nazwa grupy").fill("Brygada Lipowa");
  await form.getByRole("button", { name: "Zapisz" }).click();

  // Po zapisie wiersz się zwija i pokazuje, kto dostanie raport.
  await expect(form).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toContainText("Marek · „Brygada Lipowa”");

  await page.reload();
  await page.getByRole("tab", { name: "Dziennik" }).click();
  await page.getByTestId("study-journal").getByRole("button", { name: "Lipowa 5: karta budowy" }).click();
  await expect(page.getByTestId("site-recipients").getByRole("button", { name: /Odbiorcy raportu/ })).toContainText("Marek · „Brygada Lipowa”");
});
