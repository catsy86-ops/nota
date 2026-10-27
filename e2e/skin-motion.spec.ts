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

// Natężenie tła (plan motywów 1.3, `kaczy.backdrop.v1`).
async function openWithBackdrop(page: Page, skin: string, backdrop: "quiet" | "plain") {
  await page.addInitScript((b) => localStorage.setItem("kaczy.backdrop.v1", JSON.stringify(b)), backdrop);
  await open(page, skin);
}

test("Tło ciche: woda Hydrauliki stoi, a ozdoby przykrywa zasłona", async ({ page }) => {
  await openWithBackdrop(page, "hydraulika", "quiet");
  await expect(page.locator("html")).toHaveAttribute("data-backdrop", "quiet");
  const state = await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::after").animationPlayState);
  expect(state).toBe("paused");
  await expect(page.locator(".paper-grid > .backdrop-veil")).toHaveCount(1);
});

test("Tło gładkie: bez płótna Matrycy", async ({ page }) => {
  await openWithBackdrop(page, "matrix", "plain");
  await expect(page.locator(".paper-grid > .sig-layer")).toBeAttached();
  await expect(page.locator(".paper-grid > canvas")).toHaveCount(0);
});

test("Tło gładkie: bez bąbelków i ozdób Hydrauliki", async ({ page }) => {
  await openWithBackdrop(page, "hydraulika", "plain");
  await expect(page.locator(".paper-grid")).toBeAttached();
  await expect(page.locator(".hydro-bubble")).toHaveCount(0);
  const before = await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::before").content);
  expect(before).toBe("none");
});
