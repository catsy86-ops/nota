import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [note("a", "Alfa"), note("b", "Beta"), note("c", "Gamma")]);
  await page.goto("/");
});

test("własny szablon: zmienne podstawiają się przy tworzeniu notatki", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByRole("button", { name: "Własny" }).click();
  const dialog = page.getByRole("dialog", { name: "Nowy szablon" });
  await dialog.getByLabel("Nazwa szablonu").fill("Dziennik");
  await dialog.getByLabel("Tytuł notatki").fill("Dziennik {{data_iso}}");
  await dialog.getByLabel("Treść").fill("Rok {{rok}}");
  await dialog.getByRole("button", { name: "Zapisz szablon" }).click();

  await page.getByRole("button", { name: /Dziennik/ }).first().click();
  const card = page.getByRole("article", { name: "Dziennik 2026-10-14" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Rok 2026");
});

test("pasek zbiorczy: dodaj etykietę i przypnij zaznaczone", async ({ page }) => {
  await page.getByRole("article", { name: "Alfa" }).getByRole("button", { name: "Zaznacz notatkę" }).click();
  await page.getByRole("article", { name: "Beta" }).getByRole("button", { name: "Zaznacz notatkę" }).click();

  await page.getByRole("button", { name: "Dodaj etykietę" }).click();
  await page.getByLabel("Nowa etykieta").fill("wspolne");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Dodano #wspolne do 2")).toBeVisible();
  await expect(page.getByRole("article", { name: "Alfa" })).toContainText("wspolne");
  await expect(page.getByRole("article", { name: "Gamma" })).not.toContainText("wspolne");

  await page.getByRole("article", { name: "Gamma" }).getByRole("button", { name: "Zaznacz notatkę" }).click();
  await page.getByRole("button", { name: "Przypnij zaznaczone" }).click();
  await expect(page.getByText("Przypięto 1")).toBeVisible();
});
