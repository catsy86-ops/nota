import { test, expect, type Page } from "@playwright/test";
import { seedNotes } from "./helpers";
import { editorBody } from "./helpers/editor";

// Nowy plan 2026-11-05, Etap 5: ostatnie notatki i historia (5.1), przeciąganie listy (5.2), szukaj wszędzie (5.3),
// M i L na siatce (5.4), okruszki (5.8), domyślny szablon folderu (5.9), płótno pyta przed porzuceniem (5.10).

const NOW = new Date(2026, 9, 14, 12, 0);
const T = NOW.getTime();

const note = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id, title, content: `Treść ${title}`, color: "default", pinned: false, archived: false, labels: [], createdAt: T, updatedAt: T, ...extra,
});

async function openPalette(page: Page) {
  await page.keyboard.press("Control+k");
  return page.getByRole("dialog").getByPlaceholder(/szukaj/i);
}

async function newFolder(page: Page, name: string) {
  await page.getByRole("button", { name: "Nowy folder" }).click();
  await page.getByPlaceholder("Nazwa...").fill(name);
  await page.getByPlaceholder("Nazwa...").press("Enter");
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("paleta: ostatnio otwierane, terminy osobno i sekcja Ustawień z przewinięciem (5.1, 5.3)", async ({ page }) => {
  await seedNotes(page, [note("a", "Alfa"), note("b", "Beta zebranie", { reminder: T + 3 * 3600_000 })]);
  await page.goto("/");
  const alfa = page.locator("[data-note-id-wrap]", { hasText: "Alfa" });
  await alfa.click();
  await page.keyboard.press("Escape");

  let input = await openPalette(page);
  const recent = page.getByRole("group", { name: "Ostatnie notatki" });
  await expect(recent.getByRole("option", { name: /Alfa/ })).toBeVisible();

  await input.fill("zebranie");
  await expect(page.getByRole("group", { name: "Terminy" }).getByRole("option", { name: /Beta zebranie/ })).toBeVisible();

  await input.fill("czcionka");
  const setting = page.getByRole("group", { name: "Ustawienia" }).getByRole("option", { name: "Krój tekstu" });
  await expect(setting).toBeVisible();
  // Etap 7: trafienie w Ustawieniach to wynik — bez „Brak wyników” i „Utwórz notatkę” nad nim.
  await expect(page.getByText("Brak wyników.")).toHaveCount(0);
  await setting.click();
  const dialog = page.getByRole("dialog", { name: "Ustawienia" });
  await expect(dialog.getByRole("tab", { name: "Wygląd", selected: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Krój tekstu" })).toBeInViewport();

  // Ta sama wyszukiwarka zna też sekcje innych kart.
  await page.keyboard.press("Escape");
  input = await openPalette(page);
  await input.fill("skarbiec");
  await page.getByRole("group", { name: "Ustawienia" }).getByRole("option", { name: "Prywatne notatki" }).click();
  await expect(page.getByRole("dialog", { name: "Ustawienia" }).getByRole("tab", { name: "Ogólne", selected: true })).toBeVisible();
});

test("Alt+← wraca do poprzednio otwartej notatki, Alt+→ idzie dalej (5.1)", async ({ page }) => {
  await seedNotes(page, [note("a", "Pierwsza"), note("b", "Druga")]);
  await page.goto("/");
  const reader = page.locator('[role="dialog"][aria-label]').filter({ has: page.getByRole("heading") });
  await page.locator("[data-note-id-wrap]", { hasText: "Pierwsza" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Pierwsza" }).last()).toBeVisible();
  await page.keyboard.press("Space");
  await page.locator("[data-note-id-wrap]", { hasText: "Druga" }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("heading", { name: "Druga" }).last()).toBeVisible();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.getByRole("heading", { name: "Pierwsza" }).last()).toBeVisible();
  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.getByRole("heading", { name: "Druga" }).last()).toBeVisible();
  await expect(page).toHaveURL(/\/$/); // przeglądarka nie cofnęła strony
  void reader;
});

test("lista zadań: przeciągnięcie za uchwyt zmienia kolejność (5.2)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByText("Zapisz notatkę...").click();
  await editorBody(page).fill("Jeden\nDwa\nTrzy");
  await page.getByRole("button", { name: "Zamień na listę" }).click();
  const items = page.locator("input[data-checklist-item]");
  await expect(items).toHaveCount(3);
  // Wiersze wjeżdżają z wysokości 0 — mierzymy dopiero po animacji wejścia.
  await page.waitForTimeout(600);
  const handle = page.getByRole("button", { name: "Przeciągnij: Trzy" });
  const target = page.getByRole("button", { name: "Przeciągnij: Jeden" });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y - 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 10 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await expect(items.nth(0)).toHaveValue("Trzy");
  await expect(items.nth(1)).toHaveValue("Jeden");
});

test("siatka: M otwiera wybór folderu, L etykiety; okruszki podfolderu; domyślny szablon folderu (5.4, 5.8, 5.9)", async ({ page }) => {
  await seedNotes(page, [note("a", "Kafel")]);
  await page.goto("/");
  await newFolder(page, "Dom");

  // Fokus siatki jak w grid-reminder-key.spec: klik w tło i strzałka.
  await page.locator("body").click({ position: { x: 1200, y: 860 } });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("m");
  await expect(page.getByText("Przenieś do folderu")).toBeVisible();
  // Esc zamyka wybór folderu, fokus zostaje przy kaflu — od razu L.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Przenieś do folderu")).toHaveCount(0);
  await page.keyboard.press("l");
  await expect(page.getByText("Etykiety", { exact: true }).last()).toBeVisible();
  await page.keyboard.press("Escape");

  // Podfolder: okruszek „Dom” nad tytułem prowadzi do rodzica. Esc zwinął pasek boczny — pokazujemy go.
  const show = page.getByRole("button", { name: "Pokaż panel" });
  if (await show.isVisible()) await show.click();
  await page.getByText("Dom", { exact: true }).first().click();
  await page.getByRole("button", { name: "Akcje folderu Dom" }).click();
  await page.getByRole("menuitem", { name: "Dodaj podfolder" }).click();
  await page.getByPlaceholder("Subfolder...").fill("Remont");
  await page.getByPlaceholder("Subfolder...").press("Enter");
  await page.getByText("Remont", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Remont", level: 1 })).toBeVisible();
  const crumbs = page.getByRole("navigation", { name: "Okruszki" });
  await crumbs.getByRole("button", { name: "Dom" }).click();
  await expect(page.getByRole("heading", { name: "Dom", level: 1 })).toBeVisible();

  // Szablon: wybór w akcjach folderu, potem „Nowa: Spotkanie” tworzy notatkę w tym folderze.
  await page.getByRole("button", { name: /Domyślny szablon folderu/ }).click();
  await page.getByRole("menuitemradio", { name: /Spotkanie/ }).click();
  await page.getByTestId("folder-template-new").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Notatki ze spotkania" })).toBeVisible();
});

test("płótno: Esc przy niezapisanych kreskach pyta; „Wyczyść” ma Cofnij (5.10)", async ({ page }) => {
  await seedNotes(page, [note("a", "Szkic")]);
  // Pod obciążeniem zdarzenie „load” potrafi nie nadejść — dalej czekamy na konkretne elementy.
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const card = page.locator("[data-note-id-wrap]", { hasText: "Szkic" });
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.hover();
  await card.getByRole("button", { name: "Więcej opcji" }).click();
  await card.getByRole("button", { name: "Rysuj" }).click();
  const canvas = page.locator("canvas").last();
  const save = page.getByRole("button", { name: "Zapisz rysunek" });
  // Okno rysunku wjeżdża animacją — kreska narysowana za wcześnie się nie liczy, więc powtarzamy, aż „Zapisz” się włączy.
  await canvas.waitFor();
  await page.waitForTimeout(400);
  for (let i = 0; i < 3 && await save.isDisabled(); i++) {
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 140, box.y + 90, { steps: 6 });
    await page.mouse.up();
  }
  await expect(save).toBeEnabled();
  const ask = page.getByRole("alertdialog", { name: "Niezapisany rysunek" });
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(ask).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await ask.getByRole("button", { name: "Rysuj dalej" }).click();
  await expect(canvas).toBeVisible();

  await page.getByRole("button", { name: "Wyczyść" }).click();
  await expect(page.getByRole("button", { name: "Zapisz rysunek" })).toBeDisabled();
  await page.locator("[data-sonner-toast]").getByRole("button", { name: "Cofnij" }).click();
  await expect(page.getByRole("button", { name: "Zapisz rysunek" })).toBeEnabled();
});
