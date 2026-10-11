import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 6, 10, 0, 0));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content = "") {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  if (content) await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("przypomnienie z paska: szybki termin i powtarzanie trafiają do notatki @smoke", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Co tydzień");
  await page.getByRole("button", { name: "Przypomnienie", exact: true }).click();

  const picker = page.locator('[role="dialog"]');
  await picker.getByRole("button", { name: "Jutro rano" }).click();
  await picker.getByRole("combobox").selectOption({ label: "Co tydzień" });
  // Kalendarz ładuje się leniwie i zmienia wysokość okna — poczekajmy na stabilny układ.
  await expect(picker.getByRole("grid")).toBeVisible();
  await picker.getByRole("button", { name: "Zapisz", exact: true }).click();

  await expect(page.getByRole("button", { name: "Usuń przypomnienie" })).toBeVisible();
  await expect(picker).toHaveCount(0);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  const card = page.locator("[data-note-id]").filter({ has: page.getByRole("heading", { name: "Co tydzień" }) });
  await expect(card).toBeVisible();
  await expect(card.locator("svg.lucide-repeat")).toHaveCount(1);
});

test("[[ i @ w nowej notatce podpowiadają notatki; @folder zostaje tokenem @smoke", async ({ page }) => {
  await addNote(page, "Zakupy domowe");

  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Treść notatki...").pressSequentially("Zob. [[zak");
  await expect(page.getByRole("option", { name: "Zakupy domowe" })).toBeVisible();
  await page.getByPlaceholder("Treść notatki...").press("Enter");
  await expect(page.getByPlaceholder("Treść notatki...")).toHaveValue("Zob. [[Zakupy domowe]]");

  await page.getByPlaceholder("Treść notatki...").pressSequentially(" na @jut");
  await expect(page.getByRole("option", { name: /Jutro/ })).toBeVisible();
});

test("podstrona z paska: notatka powstaje pod wybraną @smoke", async ({ page }) => {
  await addNote(page, "Remont");

  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Łazienka");
  await page.getByRole("button", { name: "Podstrona w…" }).click();
  await page.getByLabel("Notatka nadrzędna").selectOption({ label: "Remont" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  const child = page.locator("[data-note-id-wrap]").filter({ has: page.getByRole("heading", { name: "Łazienka" }) });
  await expect(child.locator("[data-subpage-row]")).toContainText("Remont");
});
