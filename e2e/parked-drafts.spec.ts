import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function openComposer(page: Page) {
  await page.getByText("Zapisz notatkę...").click();
}

test("lista robocza: odłóż, wznów (bieżący zostaje odłożony), przeżyj przeładowanie, usuń", async ({ page }) => {
  await openComposer(page);
  await page.getByPlaceholder("Tytuł").fill("Szkic A");
  await page.getByRole("button", { name: "Odłóż", exact: true }).click();
  await expect(page.getByRole("group", { name: "Odłożone szkice" })).toBeVisible();
  await expect(page.getByPlaceholder("Tytuł")).toHaveValue("");

  await page.getByPlaceholder("Tytuł").fill("Szkic B");
  await page.getByRole("button", { name: "Odłóż", exact: true }).click();
  const group = page.getByRole("group", { name: "Odłożone szkice" });
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic B" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic A" })).toBeVisible();

  // Wznowienie A: pusty szkic, więc B zostaje tylko na liście.
  await group.getByRole("button", { name: "Wznów szkic: Szkic A" }).click();
  await expect(page.getByPlaceholder("Tytuł")).toHaveValue("Szkic A");
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic B" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic A" })).toHaveCount(0);

  // Wznowienie B, gdy A jest rozpoczęty: A trafia na listę, nic nie przepada.
  await group.getByRole("button", { name: "Wznów szkic: Szkic B" }).click();
  await expect(page.getByPlaceholder("Tytuł")).toHaveValue("Szkic B");
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic A" })).toBeVisible();
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic B" })).toHaveCount(0);

  // Przeładowanie: lista przeżywa, po otwarciu kompozytora jest dalej.
  await page.getByRole("button", { name: "Odłóż", exact: true }).click();
  await expect(group.getByRole("button", { name: "Wznów szkic: Szkic B" })).toBeVisible();
  await page.reload();
  await openComposer(page);
  await expect(page.getByRole("group", { name: "Odłożone szkice" }).getByRole("button", { name: "Wznów szkic: Szkic A" })).toBeVisible();

  // Usunięcie z „Cofnij”.
  await page.getByRole("button", { name: "Usuń odłożony szkic: Szkic A" }).click();
  await expect(page.getByRole("button", { name: "Wznów szkic: Szkic A" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("button", { name: "Wznów szkic: Szkic A" })).toBeVisible();
});
