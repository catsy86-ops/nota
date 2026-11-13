import { test, expect, type Page } from "@playwright/test";

// Plan Notatek 5.5: blok ```mermaid w czytniku. Biblioteka jest ładowana z /mermaid/<wersja>/ dopiero przy pierwszym diagramie.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const note = (id: string, title: string, content: string) => ({
  id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
  createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

/** Jedna notatka w danych: Home zaznacza pierwszy kafel, Spacja otwiera czytnik (kliknięcie kafla wchodzi w edycję). */
async function openOnly(page: Page, notes: unknown[], requested: string[] = []) {
  page.on("request", (r) => { if (r.url().includes("/mermaid/")) requested.push(r.url()); });
  await page.addInitScript((n) => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(n));
  }, notes);
  await page.goto("/");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
}

test("diagram Mermaid: SVG w czytniku, a biblioteka ładuje się dopiero przy diagramie (5.5)", async ({ page }) => {
  const requested: string[] = [];
  await openOnly(page, [note("m-ok", "Schemat", "```mermaid\ngraph TD\n  A[Start] --> B[Koniec]\n```")], requested);
  const reader = page.getByRole("dialog", { name: "Schemat" });
  await expect(reader.locator("[data-mermaid='ready'] svg")).toBeVisible({ timeout: 30_000 });
  await expect(reader.locator("[data-mermaid='ready']")).toContainText("Start");
  expect(requested.some((u) => u.endsWith("/mermaid.esm.min.mjs"))).toBe(true);
});

test("diagram Mermaid: błąd składni to komunikat ze źródłem, nie pusty czytnik (5.5)", async ({ page }) => {
  await openOnly(page, [note("m-bad", "Zły schemat", "```mermaid\ngraph TD\n  A -->\n```")]);
  const reader = page.getByRole("dialog", { name: "Zły schemat" });
  await expect(reader.locator("[data-mermaid='error']")).toBeVisible({ timeout: 30_000 });
  await expect(reader.getByRole("alert")).toBeVisible();
  await expect(reader.locator("[data-mermaid='error'] pre")).toContainText("A -->");
});

test("notatka bez diagramu nie pobiera Mermaida (5.5)", async ({ page }) => {
  const requested: string[] = [];
  await openOnly(page, [note("plain", "Zwykła", "Tekst bez diagramu.\n\n```ts\nconst a = 1;\n```")], requested);
  await expect(page.getByRole("dialog", { name: "Zwykła" })).toBeVisible();
  expect(requested).toEqual([]);
});
