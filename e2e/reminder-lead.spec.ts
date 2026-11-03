import { test, expect, type Page } from "@playwright/test";

// Terminy 3.2: wcześniejsze przypomnienie — wybór w pickerze i dymek „Za godzinę: …” przed terminem.

async function seed(page: Page, over: Record<string, unknown>) {
  await page.addInitScript((over) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const now = Date.now();
    localStorage.setItem("kaczy-notes-data", JSON.stringify([{
      id: "r1", title: "Odbiór kotłowni", content: "", color: "default", pinned: false, archived: false, trashed: false,
      trashedAt: null, labels: [], reminder: now + 30 * 60_000, priority: "none", images: [], checklist: [],
      folderId: null, order: 0, createdAt: now - 3 * 3_600_000, updatedAt: now - 3 * 3_600_000, ...over,
    }]));
  }, over);
}

test("sygnał godzinę wcześniej: dymek przed terminem, bez dymku samego terminu", async ({ page }) => {
  await seed(page, { reminderLead: 60 });
  await page.goto("/");
  const lead = page.locator("[data-sonner-toast]").filter({ hasText: "Za godzinę: Odbiór kotłowni" });
  await expect(lead).toBeVisible();
  // Termin jest za 30 minut — dymek terminu (z „Gotowe”) jeszcze się nie pokazuje.
  await expect(page.locator("[data-sonner-toast]").getByRole("button", { name: "Gotowe" })).toHaveCount(0);
  // Po przeładowaniu ten sam sygnał nie wraca.
  await page.reload();
  await expect(page.getByText("Odbiór kotłowni").first()).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(lead).toHaveCount(0);
});

test("picker: „Wcześniej: 1 h” zapisuje się i wraca przy ponownym otwarciu", async ({ page }) => {
  await seed(page, { reminder: Date.now() + 2 * 86_400_000 });
  await page.goto("/");
  await page.getByTitle("Zmień przypomnienie").click();
  const group = page.getByRole("group", { name: "Przypomnij wcześniej" });
  await expect(group.getByRole("button", { name: "Nie" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "1 h" }).click();
  await expect(page.getByTestId("reminder-preview")).toContainText("sygnał 1 h wcześniej");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(group).toHaveCount(0);

  await page.getByTitle("Zmień przypomnienie").click();
  await expect(page.getByRole("group", { name: "Przypomnij wcześniej" }).getByRole("button", { name: "1 h" })).toHaveAttribute("aria-pressed", "true");
});
