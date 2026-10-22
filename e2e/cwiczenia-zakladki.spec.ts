import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("telefon: Ćwiczenia pokazują jedną sekcję naraz (zakładki) @mobile", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("iphone"), "zakładki tylko na telefonie");
  await page.goto("/cwiczenia");
  const tabs = page.getByRole("group", { name: "Dział Ćwiczeń" });
  await expect(tabs.getByRole("button", { name: "Odżywki" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Odżywki" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Dieta|Trening/ }).first()).toBeHidden();

  await tabs.getByRole("button", { name: "Dieta" }).click();
  await expect(tabs.getByRole("button", { name: "Dieta" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "Odżywki" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Dieta" }).first()).toBeVisible();
});

test("komputer: wszystkie sekcje Ćwiczeń widoczne, bez zakładek", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("iphone"), "układ komputera");
  await page.goto("/cwiczenia");
  await expect(page.getByRole("group", { name: "Dział Ćwiczeń" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Odżywki" })).toBeVisible();
});
