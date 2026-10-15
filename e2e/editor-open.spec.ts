import { test, expect } from "@playwright/test";

// 4.3: pełny edytor rośnie z kafla, ma pasek koloru notatki, a nagłówek
// (tytuł + pasek narzędzi) dostaje cień dopiero po przewinięciu treści.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("telefon: edytor z kafla — origin w kaflu, kolor notatki, cień nagłówka po przewinięciu @mobile", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  const title = `E2E-edytor ${Date.now()}`;
  await page.getByRole("button", { name: "Nowa notatka" }).click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByPlaceholder("Treść notatki...").fill(Array.from({ length: 80 }, (_, i) => `Linia ${i + 1}`).join("\n"));
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();

  const tile = page.locator("[data-note-id-wrap]").filter({ hasText: title });
  await tile.getByRole("heading", { name: title }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Rośnie z kafla: origin poza środkiem okna, bez wjazdu z góry.
  const style = await dialog.evaluate((el) => ({
    origin: (el as HTMLElement).style.transformOrigin,
    ty: (el as HTMLElement).style.getPropertyValue("--tw-enter-translate-y"),
    scale: (el as HTMLElement).style.getPropertyValue("--tw-enter-scale"),
  }));
  expect(style.origin).toMatch(/^-?\d+px -?\d+px$/);
  expect(style.ty).toBe("0");
  expect(style.scale).toBe("0.9");

  await expect(dialog).toHaveAttribute("data-note-color", "default");
  const header = dialog.locator("[data-editor-header]");
  await expect(header).not.toHaveAttribute("data-scrolled", "");
  await dialog.getByPlaceholder("Treść notatki...").evaluate((ta) => {
    ta.scrollTop = 400;
    ta.dispatchEvent(new Event("scroll"));
  });
  await expect(header).toHaveAttribute("data-scrolled", "");
  await dialog.getByPlaceholder("Treść notatki...").evaluate((ta) => {
    ta.scrollTop = 0;
    ta.dispatchEvent(new Event("scroll"));
  });
  await expect(header).not.toHaveAttribute("data-scrolled", "");
});
