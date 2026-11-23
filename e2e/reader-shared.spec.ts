import { test, expect } from "@playwright/test";

// M4.2: zamknięcie podglądu odwraca wejście — czytnik i kafel dzielą `note-shared`, przejście nie jest przerywane.
test("podgląd wraca do kafla przejściem współdzielonego elementu", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "View Transitions tylko w Chromium");
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    const log: string[] = [];
    (window as unknown as { __vt: string[] }).__vt = log;
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = ((cb: () => void) => {
      const t = start(cb);
      t.ready.then(
        () => log.push(`ready ${document.getAnimations().map((a) => (a.effect as KeyframeEffect).pseudoElement).filter((p) => p?.includes("note-shared")).length}`),
        (e: Error) => log.push(`skipped ${e.name}`),
      );
      return t;
    }) as typeof document.startViewTransition;
  });
  await page.goto("/");
  const title = `Wspólny ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill("Treść do podglądu");
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  await page.keyboard.press(" ");
  const reader = page.getByRole("dialog", { name: title });
  await expect(reader).toHaveAttribute("data-reader-mode", "preview");
  await page.evaluate(() => ((window as unknown as { __vt: string[] }).__vt.length = 0));

  await page.keyboard.press("Escape");
  await expect(reader).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __vt: string[] }).__vt)).toEqual([expect.stringMatching(/^ready [1-9]/)]);
  // Nazwa zdjęta z kafla po przejściu.
  await expect.poll(() => page.locator("[data-note-id-wrap]").first().evaluate((el) => (el as HTMLElement).style.viewTransitionName)).toBe("");
});
