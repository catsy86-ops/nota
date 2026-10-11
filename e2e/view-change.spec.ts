import { test, expect, type Page } from "@playwright/test";

// 2b.9: zmiana układu, kolumn i gęstości nie przerzuca w inne miejsce listy —
// kafel, który był u góry ekranu, zostaje tam po zmianie.

const NOW = Date.now();
const note = (i: number) => ({
  id: `v${i}`, title: `Widok ${i}`, content: Array.from({ length: 1 + (i % 4) }, (_, k) => `Linia ${k + 1}`).join("\n\n"),
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null,
  priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: NOW - i * 1000, updatedAt: NOW - i * 1000,
});
const NOTES = Array.from({ length: 160 }, (_, i) => note(i + 1));
const ANCHOR = "v70";
const ANCHOR_Y = 300;

async function seed(page: Page) {
  await page.addInitScript((notes) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
  }, NOTES);
  await page.goto("/");
  // Render progresywny: przewijamy dopiero, gdy są wszystkie kafle (inaczej strona bywa za krótka).
  await expect(page.locator("[data-note-id-wrap]")).toHaveCount(NOTES.length);
}

const item = (page: Page) => page.locator(`[data-note-id-wrap="${ANCHOR}"], [data-note-row="${ANCHOR}"]`);
// W trakcie podmiany widoku (np. tabela → siatka) element bywa na chwilę bez pudełka — poll ponawia.
const topOf = async (page: Page) => (await item(page).boundingBox())?.y ?? Infinity;

async function scrollAnchorTo(page: Page, y: number) {
  await item(page).evaluate((el, target) => window.scrollBy({ top: el.getBoundingClientRect().top - target, behavior: "instant" as ScrollBehavior }), y);
  await expect.poll(async () => Math.abs((await topOf(page)) - y)).toBeLessThan(2);
}

/** Ta sama reguła co `captureAnchor`: najwyższy kafel/wiersz zaczynający się pod nagłówkiem (72 px). */
async function topVisible(page: Page) {
  return page.evaluate(() => {
    let best: { id: string; top: number; left: number } | null = null;
    for (const el of document.querySelectorAll("[data-note-id-wrap], [data-note-row]")) {
      const r = el.getBoundingClientRect();
      if (r.top < 72 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth) continue;
      const id = el.getAttribute("data-note-id-wrap") ?? el.getAttribute("data-note-row")!;
      if (!best || r.top < best.top - 1 || (Math.abs(r.top - best.top) <= 1 && r.left < best.left)) best = { id, top: r.top, left: r.left };
    }
    return best!;
  });
}

/** Zmiana widoku, po której kafel z góry ekranu stoi tam, gdzie stał (±2 px). */
async function expectAnchorKept(page: Page, change: () => Promise<void>) {
  const before = await topVisible(page);
  await change();
  const el = page.locator(`[data-note-id-wrap="${before.id}"], [data-note-row="${before.id}"]`);
  await expect.poll(async () => Math.abs(((await el.boundingBox())?.y ?? Infinity) - before.top), {
    timeout: 3000,
    message: `kafel ${before.id} (było y=${Math.round(before.top)}, scrollY=${await page.evaluate(() => `${scrollY}/${document.documentElement.scrollHeight - innerHeight}`)})`,
  }).toBeLessThan(3);
}

test.describe("komputer", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  // Na komputerze nagłówek nie jest przyklejony — menu otwieramy u góry strony, przewijamy
  // pod otwartym menu i wybieramy klawiaturą (kliknięcie Playwrighta przewinęłoby do przycisku).
  async function pick(page: Page, name: string) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: "Widok i kolumny" }).click();
    await scrollAnchorTo(page, ANCHOR_Y);
    await page.getByRole("menuitemradio", { name }).evaluate((el: HTMLElement) => el.focus({ preventScroll: true }));
    await expectAnchorKept(page, () => page.keyboard.press("Enter"));
    await expect(page.getByRole("menu")).toBeHidden();
  }

  test("mozaika → lista → tabela → siatka: kafel u góry zostaje na miejscu", async ({ page }) => {
    await seed(page);
    for (const layout of ["Lista", "Tabela", "Siatka", "Mozaika"]) await pick(page, layout);
  });

  test("przy samej górze strony zmiana układu zostawia stronę na górze", async ({ page }) => {
    await seed(page);
    await page.getByRole("button", { name: "Widok i kolumny" }).click();
    await page.getByRole("menuitemradio", { name: "Lista" }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("telefon", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("arkusz „Widok”: zmiana układu i kolumn nie przewija listy", async ({ page }) => {
    await seed(page);
    await scrollAnchorTo(page, ANCHOR_Y);
    await page.getByRole("button", { name: "Widok i kolumny" }).click();
    const sheet = page.getByRole("dialog");
    await expectAnchorKept(page, () => sheet.getByRole("radio", { name: /Lista/ }).click());
    await expectAnchorKept(page, () => sheet.getByRole("radio", { name: /Siatka/ }).click());
    await expectAnchorKept(page, () => sheet.getByRole("radio", { name: "1 kolumna" }).click());
    await expectAnchorKept(page, () => sheet.getByRole("radio", { name: "Luźno" }).click());
  });
});
