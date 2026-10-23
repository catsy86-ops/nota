import { test, expect, type Page } from "@playwright/test";

// Osadzanie notatek (Faza 3.3): ![[Tytuł#Nagłówek]] pokazuje tylko tę sekcję; cykl kończy się komunikatem.
// Notatka startowa ma link [[…]], którym otwieramy testowaną notatkę w czytniku.
const NOW = new Date(2026, 9, 14, 12, 0).getTime();
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

test("![[notatka#nagłówek]] osadza tylko tę sekcję", async ({ page }) => {
  await seed(page, [
    { ...base, id: "p", title: "Plan", order: 3, updatedAt: NOW - 5000, content: "## Etap 1\n- zrobić A\n\n## Etap 2\n- zrobić B" },
    { ...base, id: "z", title: "Zakupy", order: 0, updatedAt: NOW, content: "Przed\n\n![[Plan#Etap 1]]\n\nPo" },
    { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Zakupy]]" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Zakupy" });
  await expect(reader).toBeVisible();
  const embed = reader.locator("[data-embed]");
  await expect(embed).toContainText("zrobić A");
  await expect(embed).toContainText("Plan › Etap 1");
  await expect(embed).not.toContainText("zrobić B");
});

test("cykl A ↔ B kończy się komunikatem, nie pętlą", async ({ page }) => {
  await seed(page, [
    { ...base, id: "a", title: "Cykl A", order: 0, updatedAt: NOW, content: "początek A\n\n![[Cykl B]]" },
    { ...base, id: "b", title: "Cykl B", order: 3, updatedAt: NOW - 5000, content: "początek B\n\n![[Cykl A]]" },
    { ...base, id: "s", title: "Start", order: 5, updatedAt: NOW - 5000, content: "Otwórz [[Cykl A]]" },
  ]);
  await page.goto("/");
  await openFirstInReader(page);
  const reader = page.getByRole("dialog", { name: "Cykl A" });
  await expect(reader).toBeVisible();
  await expect(reader.locator("[data-embed-notice]").filter({ hasText: "Cykl:" }).first()).toBeVisible();
});
