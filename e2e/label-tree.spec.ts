import { test, expect } from "@playwright/test";
import { seedNotes } from "./helpers";

// Etykiety zagnieżdżone (Faza 3.2): pasek boczny pokazuje drzewo z wcięciem,
// a filtr po rodzicu obejmuje dzieci.
const NOW = Date.now();
const note = (id: string, title: string, labels: string[]) => ({
  id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels, reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

test("drzewo etykiet: dziecko z wcięciem, filtr po rodzicu pokazuje dzieci", async ({ page }) => {
  await seedNotes(page, [
    note("a", "Płytki w łazience", ["budowa/łazienka"]),
    note("b", "Zakupy z hurtowni", ["praca"]),
  ]);
  await page.goto("/");

  // Rodzic i dziecko są w pasku bocznym jako osobne wiersze; dziecko ma większe wcięcie.
  const parent = page.locator("aside, nav, [data-sidebar]").getByText("budowa", { exact: true }).first();
  const child = page.locator("aside, nav, [data-sidebar]").getByText("łazienka", { exact: true }).first();
  await expect(parent).toBeVisible();
  await expect(child).toBeVisible();
  const indentOf = (el: Element) => (el.closest("[style*='padding-left']") as HTMLElement | null)?.style.paddingLeft ?? "0";
  const [pl, cl] = await Promise.all([parent.evaluate(indentOf), child.evaluate(indentOf)]);
  expect(parseFloat(cl)).toBeGreaterThan(parseFloat(pl));

  // Klik w rodzica filtruje po nim: widać notatkę z dzieckiem, bez „praca”.
  await parent.click();
  await expect(page.getByRole("heading", { name: "Płytki w łazience" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zakupy z hurtowni" })).toHaveCount(0);
});
