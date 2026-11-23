import { test, expect, type Page } from "@playwright/test";

// A2.5: ile razy renderują się Index, nagłówek, pasek i siatka przy wpisaniu znaku w wyszukiwarce i przy zmianie jednej notatki.
// Liczniki: `src/lib/renderProbe.ts`. Test nie ma progów — wypisuje liczby (przed/po zmianach w A2.5+); pilnuje tylko, że Index renderuje się w ogóle.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    (window as unknown as { __renderProbe: Record<string, number> }).__renderProbe = {};
  });
  await page.goto("/");
});

const counts = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __renderProbe: Record<string, number> }).__renderProbe }));
const diff = (a: Record<string, number>, b: Record<string, number>) =>
  Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - (a[k] ?? 0)]));

test("liczba renderów: znak w wyszukiwarce i zmiana jednej notatki", async ({ page }) => {
  for (const title of ["Alfa", "Beta", "Gamma"]) {
    await page.getByText("Zapisz notatkę...").click();
    await page.getByPlaceholder("Tytuł").fill(title);
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByText("Zapisz notatkę...")).toBeVisible();
  }
  await page.waitForTimeout(800);

  const s0 = await counts(page);
  await page.getByRole("searchbox").first().pressSequentially("a");
  await page.waitForTimeout(600);
  const s1 = await counts(page);
  console.log("[render] znak w wyszukiwarce:", JSON.stringify(diff(s0, s1)));

  await page.getByRole("searchbox").first().fill("");
  await page.waitForTimeout(600);
  const n0 = await counts(page);
  await page.getByRole("button", { name: /przypnij/i }).first().click({ force: true });
  await page.waitForTimeout(600);
  const n1 = await counts(page);
  const change = diff(n0, n1);
  console.log("[render] zmiana jednej notatki (przypięcie):", JSON.stringify(change));
  expect(change.Index ?? 0).toBeGreaterThan(0);
});
