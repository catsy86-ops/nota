import { test, expect } from "@playwright/test";

// H5.1 Autor: wpis z innego telefonu ma „Marek,” przy godzinie; imię ustawia się w Ustawieniach → Ogólne.

test("autor przy wpisie z innego telefonu; swoje imię w Ustawieniach", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.author.v1", JSON.stringify("Grzegorz"));
    const at = new Date(2026, 10, 2, 9, 40).getTime();
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [
        { id: "a", at, kind: "ok", topic: null, text: "Pion gotowy", site: "Lipowa 5", checked: [], images: [], by: "Marek" },
        { id: "b", at: at + 60_000, kind: "ok", topic: null, text: "Mój wpis", site: "Lipowa 5", checked: [], images: [], by: "Grzegorz" },
      ],
    }));
  });
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0).getTime());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const by = page.getByTestId("entry-by");
  await expect(by).toHaveCount(1);
  await expect(by).toHaveText("Marek,");

  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Ogólne" }).click();
  const field = page.getByLabel(/Podpisuje Twoje wpisy/);
  await expect(field).toHaveValue("Grzegorz");
  await field.fill("Marek");
  await field.blur();
  await page.keyboard.press("Escape");
  // Teraz „Marek” to ja — podpisany jest wpis Grzegorza.
  await expect(page.getByTestId("entry-by")).toHaveText("Grzegorz,");
});
