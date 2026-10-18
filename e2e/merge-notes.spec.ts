import { test, expect } from "@playwright/test";
import { undoIn } from "./helpers";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string, content: string, extra: Record<string, unknown> = {}) => ({
  id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000, ...extra,
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((n) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, [
    note("a", "Alfa", "Pierwsza treść", { labels: ["praca"] }),
    note("b", "Beta", "Druga treść", { labels: ["dom"] }),
    note("c", "Gamma", "Trzecia treść"),
  ]);
  await page.goto("/");
});

test("scalanie dwóch notatek: treść w pierwszej, druga w koszu, Cofnij przywraca", async ({ page }) => {
  await page.getByRole("article", { name: "Alfa" }).getByRole("button", { name: "Zaznacz notatkę" }).click();
  await page.getByRole("article", { name: "Beta" }).getByRole("button", { name: "Zaznacz notatkę" }).click();

  await page.getByRole("button", { name: "Scal zaznaczone w jedną notatkę" }).click();
  await expect(page.getByText("Scalono 2 notatek")).toBeVisible();

  const alfa = page.getByRole("article", { name: "Alfa" });
  await expect(alfa).toContainText("Pierwsza treść");
  await expect(alfa).toContainText("Druga treść");
  await expect(alfa).toContainText("praca");
  await expect(alfa).toContainText("dom");
  await expect(page.getByRole("article", { name: "Beta" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Gamma" })).toBeVisible();

  await undoIn(page, "Scalono 2").click();
  await expect(page.getByRole("article", { name: "Beta" })).toBeVisible();
  await expect(alfa).not.toContainText("Druga treść");
  await expect(alfa).toContainText("Pierwsza treść");
});

test("scalanie pojedynczej notatki jest odmawiane z komunikatem", async ({ page }) => {
  await page.getByRole("article", { name: "Alfa" }).getByRole("button", { name: "Zaznacz notatkę" }).click();
  await page.getByRole("button", { name: "Scal zaznaczone w jedną notatkę" }).click();
  await expect(page.getByText("Zaznacz co najmniej dwie notatki.")).toBeVisible();
  await expect(page.getByRole("article", { name: "Beta" })).toBeVisible();
});
