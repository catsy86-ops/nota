import { test, expect } from "@playwright/test";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const base = {
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
};

test("[[tytuł#nagłówek]] otwiera notatkę w czytniku i przewija do nagłówka", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  const filler = Array.from({ length: 60 }, (_, i) => `Akapit wypełniający numer ${i + 1}.`).join("\n\n");
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [
    { ...base, id: "a", title: "Długi plan", order: 0, content: `# Wstęp\n\n${filler}\n\n## Etap drugi\n\nTu jest cel.\n\n${filler}` },
    { ...base, id: "b", title: "Skrót", order: 1, content: "Zobacz [[Długi plan#Etap drugi]]" },
  ]);
  await page.goto("/");

  const link = page.getByRole("button", { name: /Długi plan › Etap drugi/ });
  await expect(link).toBeVisible();
  await link.click();

  const heading = page.getByRole("dialog", { name: "Długi plan" }).getByRole("heading", { name: "Etap drugi" });
  await expect(heading).toBeVisible();
  await expect(heading).toBeInViewport();
});
