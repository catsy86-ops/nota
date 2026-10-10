import { test, expect, type Page } from "@playwright/test";

const NOW = Date.now();
const note = (i: number, lines: number) => ({
  id: `m${i}`, title: `Mozaika ${i}`, content: Array.from({ length: lines }, (_, k) => `Linia ${k + 1}`).join("\n\n"),
  color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null,
  priority: "none", images: [], checklist: [], folderId: null, order: i, createdAt: NOW - i * 1000, updatedAt: NOW - i * 1000,
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript((notes) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy-notes-data", JSON.stringify(notes));
  }, [note(1, 1), note(2, 4), note(3, 1), note(4, 2), note(5, 1), note(6, 3)]);
  await page.goto("/");
  await expect(page.getByText("Mozaika 6")).toBeVisible();
});

const box = async (page: Page, id: string) => (await page.locator(`[data-note-id-wrap="${id}"]`).boundingBox())!;

test("mozaika układa karty od lewej do prawej, bez nakładania", async ({ page }) => {
  const [a, b, c] = [await box(page, "m1"), await box(page, "m2"), await box(page, "m3")];
  expect(Math.abs(a.y - b.y)).toBeLessThan(2);
  expect(Math.abs(b.y - c.y)).toBeLessThan(2);
  expect(a.x).toBeLessThan(b.x);
  expect(b.x).toBeLessThan(c.x);
  // Szósta karta trafia pod krótką kartę, nie pod najdłuższą (2).
  const six = await box(page, "m6");
  expect(Math.abs(six.x - b.x)).toBeGreaterThan(5);
});

test("przeciągnięcie karty zmienia kolejność i przełącza na sortowanie ręczne", async ({ page }) => {
  const card = page.locator('[data-note-id-wrap="m1"]');
  await card.hover();
  const handle = card.getByLabel("Przeciągnij, aby zmienić kolejność");
  const from = (await handle.boundingBox())!;
  const to = await box(page, "m3");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText("Przełączono na sortowanie ręczne")).toBeVisible();
  const order = await page.locator("[data-note-id-wrap]").evaluateAll((els) => els.map((e) => e.getAttribute("data-note-id-wrap")));
  expect(order.indexOf("m1")).toBeGreaterThan(order.indexOf("m3"));
});

test("edycja w kaflu na komputerze zajmuje dwie kolumny i wraca po zapisie", async ({ page }) => {
  const wrap = page.locator('[data-note-id-wrap="m3"]');
  const before = (await wrap.boundingBox())!;
  await wrap.getByText("Mozaika 3").click();
  await expect(wrap.getByPlaceholder("Treść notatki...")).toBeVisible();
  await expect.poll(async () => (await wrap.boundingBox())!.width).toBeGreaterThan(before.width * 1.8);
  await wrap.getByRole("button", { name: "Zapisz" }).click();
  await expect.poll(async () => (await wrap.boundingBox())!.width).toBeLessThan(before.width * 1.2);
});
