import { test, expect, type Page } from "@playwright/test";

/** Notatka z przypomnieniem `inMs` od teraz (ujemne = zaległe), wpisana przed startem aplikacji. */
async function seedReminder(page: Page, title: string, inMs: number) {
  await page.addInitScript(({ title, inMs }) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const now = Date.now();
    localStorage.setItem("kaczy-notes-data", JSON.stringify([{
      id: "r1", title, content: "", color: "default", pinned: false, archived: false, trashed: false,
      trashedAt: null, labels: [], reminder: now + inMs, priority: "none", images: [], checklist: [],
      folderId: null, order: 0, createdAt: now, updatedAt: now,
    }]));
  }, { title, inMs });
}

test("zaległe przypomnienie: odłożenie z menu zamyka okienko", async ({ page }) => {
  await seedReminder(page, "Opłacić prąd", -60 * 60 * 1000);
  await page.goto("/");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Opłacić prąd" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(/dziś|wczoraj/);

  await toast.getByRole("button", { name: "Odłóż" }).click();
  await page.getByRole("menuitem", { name: "Za 10 minut" }).click();
  await expect(toast).toHaveCount(0);
  // Termin przesunięty w przyszłość — notatka nie jest już zaległa.
  await page.goto("/przypomnienia");
  await expect(page.getByText("Zaległe")).toHaveCount(0);
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("przypomnienie u góry ekranu i klikalne nad otwartym edytorem", async ({ page }) => {
    test.slow();
    await seedReminder(page, "Zadzwonić do kadr", 4000);
    await page.goto("/");
    await page.getByText("Zadzwonić do kadr").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Sprawdzenie terminów co 15 s.
    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Zadzwonić do kadr" });
    await expect(toast).toBeVisible({ timeout: 25000 });
    expect((await toast.boundingBox())!.y).toBeLessThan(150);

    await toast.getByRole("button", { name: "Gotowe" }).click();
    await expect(toast).toHaveCount(0);
    // Klik w dymek nie liczy się jako „poza oknem” — edytor zostaje otwarty.
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test("kilka zaległych naraz: jeden zbiorczy dymek z „Zobacz” prowadzi do Przypomnień", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const now = Date.now();
    const base = { content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: now, updatedAt: now };
    localStorage.setItem("kaczy-notes-data", JSON.stringify([
      { ...base, id: "a", title: "Rachunek za wodę", reminder: now - 3600_000 },
      { ...base, id: "b", title: "Przegląd auta", reminder: now - 7200_000 },
      { ...base, id: "c", title: "Kupić filtry", reminder: now - 60_000 },
    ]));
  });
  await page.goto("/");
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "3 przypomnienia czekają" });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText("Rachunek za wodę");
  // Bez osobnych dymków dla każdej notatki.
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Odłóż" })).toHaveCount(0);
  await toast.getByRole("button", { name: "Zobacz" }).click();
  await expect(page).toHaveURL(/\/przypomnienia/);
});

test("zaległy termin: „Gotowe” na kaflu odhacza bez otwierania notatki, Cofnij przywraca", async ({ page }) => {
  await seedReminder(page, "Zapłacić czynsz", -2 * 60 * 60 * 1000);
  await page.goto("/przypomnienia");
  const card = page.locator('[data-note-id="r1"]');
  await expect(card.getByRole("button", { name: "Gotowe" })).toBeVisible();
  await card.getByRole("button", { name: "Gotowe" }).click();
  await expect(page.getByRole("dialog", { name: /Edycja notatki/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Zaległe" })).toHaveCount(0);
  await page.getByRole("listitem").filter({ hasText: "Przypomnienie odhaczone" }).getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("region", { name: "Zaległe" })).toBeVisible();
});
