import { test, expect, type Page } from "@playwright/test";

// Odnośniki do bloków `^id` (Faza 3.4): ![[Tytuł#^id]] osadza tylko ten akapit, a znacznik
// `^id` nie jest widoczny w czytniku.
const NOW = new Date(2026, 9, 24, 12, 0).getTime();
const base = {
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
};

async function seed(page: Page, notes: unknown[]) {
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, notes);
}

/** Pierwsza notatka na liście (order 0) zaznaczana przez Home; spacja otwiera czytnik. */
async function openFirstInReader(page: Page) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
}

test("![[notatka#^id]] osadza tylko akapit o tym id, bez znacznika", async ({ page }) => {
  await seed(page, [
    { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "Pierwszy akapit\n\nPomysł na szafkę ^szafka\n\nTrzeci akapit" },
    { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "Przed\n\n![[Plan#^szafka]]\n\nPo" },
    { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Zakupy]]" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();
  const embed = reader.locator("[data-embed]");
  await expect(embed).toContainText("Pomysł na szafkę");
  await expect(embed).toContainText("Plan › ^szafka");
  await expect(embed).not.toContainText("Pierwszy akapit");
  // Znacznik zostaje w notatce źródłowej, ale nie w treści osadzenia.
  await expect(embed.locator("p")).toHaveText("Pomysł na szafkę");
});

test("nieistniejący blok pokazuje komunikat, a nie pustą ramkę", async ({ page }) => {
  await seed(page, [
    { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "Tekst bez bloku" },
    { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "![[Plan#^brak]]" },
    { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Zakupy]]" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();
  await expect(reader.locator("[data-embed-notice]").filter({ hasText: "Nie ma bloku ^brak" })).toBeVisible();
});
