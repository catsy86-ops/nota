import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(title)).toBeVisible();
}

test("[[ podpowiada tytuły, a notatka docelowa pokazuje backlink", async ({ page }) => {
  const stamp = Date.now();
  const target = `Zakupy ${stamp}`;
  const source = `Lista ${stamp}`;
  await addNote(page, target);
  await addNote(page, source);

  await page.getByText(source).click();
  const editor = page.locator("[data-note-id] textarea").first();
  await editor.click();
  await editor.pressSequentially("Patrz [[zak");
  const option = page.getByRole("option", { name: target });
  await expect(option).toBeVisible();
  await editor.press("Enter");
  await expect(editor).toHaveValue(`Patrz [[${target}]]`);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  const targetCard = page.locator("[data-note-id]").filter({ hasText: target }).filter({ hasText: "Linkują tu:" });
  await expect(targetCard).toBeVisible();
  await targetCard.getByRole("button", { name: source }).click();
  await expect(page.locator("[data-note-id].note-flash").filter({ hasText: source })).toBeVisible();
});

test("Esc chowa podpowiedzi bez zamykania edytora", async ({ page }) => {
  const stamp = Date.now();
  await addNote(page, `Cel ${stamp}`);
  await addNote(page, `Źródło ${stamp}`);

  await page.getByText(`Źródło ${stamp}`).click();
  const editor = page.locator("[data-note-id] textarea").first();
  await editor.click();
  await editor.pressSequentially("[[Cel");
  await expect(page.getByRole("option", { name: `Cel ${stamp}` })).toBeVisible();
  await editor.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(editor).toBeVisible();
});
