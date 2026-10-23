import { test, expect, type Page } from "@playwright/test";

/** Sygnatury ruchu stylów (plan rozbudowy, Faza 1b). Efekty w transform/opacity; ograniczony ruch = stan końcowy bez animacji. */
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

test("Zeszyt: pióro podkreśla nagłówek (animacja na ::after)", async ({ page }) => {
  await open(page, "zeszyt");
  const anim = await page.locator("h1, h2").first().evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(anim).toBe("zeszyt-pen");
});

test("Zeszyt przy ograniczonym ruchu: podkreślenie od razu pełne, bez animacji", async ({ page }) => {
  await open(page, "zeszyt", "reduced");
  const style = await page.locator("h1, h2").first().evaluate((el) => {
    const cs = getComputedStyle(el, "::after");
    return { anim: cs.animationName, transform: cs.transform };
  });
  expect(style.anim).toBe("none");
  // Macierz tożsamości (scaleX 1), a nie 0×: stan końcowy animacji, a nie ukryta kreska.
  expect(style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
});

test("Plan: siatka wjeżdża przy otwarciu, a przy ograniczonym ruchu jest od razu widoczna", async ({ page }) => {
  await open(page, "plan");
  const grid = page.locator(".paper-grid");
  await expect(grid).toHaveCount(1);
  expect(await grid.evaluate((el) => getComputedStyle(el, "::before").animationName)).toBe("plan-draw");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const after = await page.locator(".paper-grid").evaluate((el) => {
    const cs = getComputedStyle(el, "::before");
    return { anim: cs.animationName, opacity: cs.opacity };
  });
  expect(after.anim).toBe("none");
  expect(after.opacity).toBe("1");
});

test("Neon: poświata kafla przy fokusie klawiatury", async ({ page }) => {
  await open(page, "neon");
  const title = `Neon-fokus ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.getByRole("heading", { name: title, exact: true }).click();
  const anim = await page.locator(".note-card:focus-within").first().evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(anim).toBe("neon-flare");
});

async function saveNoteAndReadSignal(page: Page, title: string): Promise<string | undefined> {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  return page.evaluate(() => document.documentElement.dataset.sig);
}

test("Miedź: zapis puszcza parę z rury (animacja na paper-grid::after)", async ({ page }) => {
  await open(page, "miedz");
  const title = `Miedz-para ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  // Sygnał trwa ~1,4 s; odczyt zaraz po zapisie.
  const anim = await page.locator(".paper-grid").evaluate((el) => {
    return { sig: document.documentElement.dataset.sig, anim: getComputedStyle(el, "::after").animationName };
  });
  expect(anim.sig).toBe("save");
  expect(anim.anim).toBe("miedz-steam");
});

test("Hydraulika: zapis wypełnia rurę falą, a przy ograniczonym ruchu nie ma animacji", async ({ page }) => {
  await open(page, "hydraulika");
  const title = `Hydro-fala ${Date.now()}`;
  const sig = await saveNoteAndReadSignal(page, title);
  expect(sig).toBe("save");
  const anim = await page.locator(".hydro-bubbles").evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(anim).toBe("hydro-fill");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const again = await saveNoteAndReadSignal(page, `${title} r`);
  expect(again).toBe("save");
  const reduced = await page.locator(".hydro-bubbles").evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(reduced).toBe("none");
});
