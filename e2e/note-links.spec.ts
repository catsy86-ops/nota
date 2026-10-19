import { test, expect, type Page } from "@playwright/test";

// Powiązania: podgląd [[linku]], niepołączone wzmianki, graf powiązań.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

async function addNote(page: Page, title: string, content: string) {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill(content);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

/** Najnowsza notatka jest pierwsza: Home ją zaznacza, Spacja otwiera czytnik. */
async function openNewestInReader(page: Page, title: string) {
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await expect(reader).toBeVisible();
  return reader;
}

test("najechanie na [[link]] pokazuje podgląd z przyciskiem Otwórz", async ({ page }) => {
  const stamp = Date.now();
  const target = `Cel ${stamp}`;
  const source = `Źródło ${stamp}`;
  await addNote(page, target, "Pierwsza linia celu\n\nDruga linia celu");
  await addNote(page, source, `Zobacz [[${target}]]`);

  const reader = await openNewestInReader(page, source);
  await reader.getByRole("button", { name: target }).hover();
  const preview = page.locator("[data-wiki-preview]");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(target);
  await expect(preview).toContainText("Pierwsza linia celu");
  await expect(preview).toContainText("Druga linia celu");

  await preview.getByRole("button", { name: /Otwórz/ }).click();
  await expect(page.getByRole("dialog", { name: target })).toBeVisible();
});

test("podgląd działa też z klawiatury, a Esc go chowa", async ({ page }) => {
  const stamp = Date.now();
  const target = `Klawisz ${stamp}`;
  const source = `Zrodlo ${stamp}`;
  await addNote(page, target, "Treść do podejrzenia");
  await addNote(page, source, `Zobacz [[${target}]]`);

  const reader = await openNewestInReader(page, source);
  // Ostatnia interakcja była z klawiatury, więc fokus programowy liczy się jako :focus-visible.
  await reader.getByRole("button", { name: target }).focus();
  const preview = page.locator("[data-wiki-preview]");
  await expect(preview).toContainText("Treść do podejrzenia");
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
});

test("link do nieistniejącej notatki tworzy ją jednym kliknięciem", async ({ page }) => {
  const stamp = Date.now();
  const missing = `Brakująca ${stamp}`;
  const source = `Autor ${stamp}`;
  await addNote(page, source, `Kiedyś napiszę [[${missing}]]`);

  const reader = await openNewestInReader(page, source);
  await reader.getByRole("button", { name: missing }).hover();
  const preview = page.locator("[data-wiki-preview]");
  await expect(preview).toContainText("jeszcze nie istnieje");
  await preview.getByRole("button", { name: new RegExp(`Utwórz notatkę.*${missing}`) }).click();
  await expect(page.getByText(`Utworzono notatkę „${missing}”`)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: missing })).toBeVisible();
});

test("niepołączone wzmianki: Połącz zamienia wystąpienie na link, Cofnij przywraca", async ({ page }) => {
  const stamp = Date.now();
  const target = `Projekt${stamp}`;
  const source = `Dziennik ${stamp}`;
  await addNote(page, source, `Dziś pracuję nad ${target} do wieczora.`);
  await addNote(page, target, "Opis projektu");

  const reader = await openNewestInReader(page, target);
  const section = reader.locator("[data-unlinked-mentions]");
  await expect(section).toContainText("Niepołączone wzmianki (1)");
  await expect(section).toContainText(source);

  await section.getByRole("button", { name: "Połącz" }).click();
  await expect(section).toHaveCount(0);
  await expect(reader.getByRole("button", { name: source })).toBeVisible(); // teraz to backlink

  await expect(page.locator("[data-note-id]").filter({ hasText: source }).locator("[data-wiki-link]")).toHaveCount(1);
  await page.getByRole("listitem").filter({ hasText: "Połączono" }).getByRole("button", { name: "Cofnij" }).click();
  // Klik w toast zamyka czytnik (jak każdy klik poza nim); sprawdzamy kartę źródła.
  await expect(page.getByText("Cofnięto")).toBeVisible();
  const card = page.locator("[data-note-id]").filter({ hasText: source });
  await expect(card).toContainText(`nad ${target} do wieczora`);
  await expect(card.locator("[data-wiki-link]")).toHaveCount(0);
});

test("graf powiązań z palety: węzły i otwarcie notatki", async ({ page }) => {
  const stamp = Date.now();
  const a = `Alfa ${stamp}`;
  const b = `Beta ${stamp}`;
  await addNote(page, b, "Beta treść");
  await addNote(page, a, `Łączy się z [[${b}]]`);

  await page.keyboard.press("Control+k");
  await page.getByRole("searchbox", { name: "Szukaj w notatkach" }).fill("Graf powiązań");
  await page.getByRole("option", { name: /Graf powiązań/ }).click();

  const graph = page.getByTestId("link-graph");
  await expect(graph).toBeVisible();
  await expect(graph.locator("[data-graph-node]")).toHaveCount(2);

  await graph.getByRole("link", { name: new RegExp(`^${b}`) }).click();
  await expect(graph).toHaveCount(0);
  await expect(page.locator("[data-note-id].note-flash").filter({ hasText: b })).toBeVisible();
});
