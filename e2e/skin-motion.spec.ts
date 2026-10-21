import { test, expect, type Page } from "@playwright/test";

async function open(page: Page, skin: string, motion: "full" | "reduced" = "full") {
  await page.addInitScript(
    ([s, m]) => {
      localStorage.setItem("kaczy.tour.seen.v1", "1");
      localStorage.setItem("kaczy.skin.v1", JSON.stringify(s));
      localStorage.setItem("kaczy.motion.v1", JSON.stringify(m));
    },
    [skin, motion] as const,
  );
  await page.goto("/");
}

test("Matryca: płótno deszczu jest pod kartami, przygaszone i gaśnie pod nagłówkiem", async ({ page }) => {
  await open(page, "matrix");
  const canvas = page.locator(".paper-grid > canvas");
  await expect(canvas).toHaveCount(1);
  const style = await canvas.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, mask: cs.maskImage || cs.webkitMaskImage };
  });
  expect(Number(style.opacity)).toBeLessThan(1);
  expect(style.mask).toContain("linear-gradient");
  // Winieta za środkiem istnieje tylko w tym stylu.
  const vignette = await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::after").backgroundImage);
  expect(vignette).toContain("radial-gradient");
});

test("Hydraulika: bąbelki płyną, a przy ograniczonym ruchu znikają", async ({ page }) => {
  await open(page, "hydraulika");
  const bubbles = page.locator(".hydro-bubble");
  await expect(bubbles.first()).toBeAttached();
  expect(await bubbles.count()).toBeGreaterThan(0);
  const anim = await bubbles.first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(bubbles.first()).toBeHidden();
});

test("Hydraulika w trybie ograniczonego ruchu: woda stoi (brak animacji przepływu)", async ({ page }) => {
  await open(page, "hydraulika", "reduced");
  const flow = await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(flow).toBe("none");
});
