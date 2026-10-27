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

test("Matryca: zmiana widoku spływa kaskadą kolumn (sygnał view)", async ({ page }) => {
  await open(page, "matrix");
  await page.getByRole("button", { name: "Dziś", exact: true }).first().click();
  const anim = await page.locator(".paper-grid").evaluate((el) => ({
    sig: document.documentElement.dataset.sig,
    name: getComputedStyle(el, "::before").animationName,
  }));
  expect(anim.sig).toBe("view");
  expect(anim.name).toBe("matrix-cascade");
});

test("Zeszyt: zmiana widoku przewraca kartkę", async ({ page }) => {
  await open(page, "zeszyt");
  await page.getByRole("button", { name: "Dziś", exact: true }).first().click();
  const name = await page.locator(".paper-grid").evaluate((el) => getComputedStyle(el, "::before").animationName);
  expect(name).toBe("zeszyt-flip");
});

test("Neon: pierwsze uruchomienie dnia rozbłyska nagłówek", async ({ page }) => {
  await open(page, "neon");
  const info = await page.evaluate(() => ({
    sig: document.documentElement.dataset.sig,
    anim: getComputedStyle(document.querySelector("h1")!).animationName,
  }));
  expect(info.sig).toBe("dawn");
  expect(info.anim).toBe("neon-ignite");
});

test("Zorza: wstęgi są przesuwane zmienną paralaksy (translate), a nie zmieniają dryfu", async ({ page }) => {
  await open(page, "zorza");
  const t = await page.locator(".paper-grid").evaluate((el) => {
    const cs = getComputedStyle(el, "::after");
    return { translate: cs.translate, anim: cs.animationName };
  });
  expect(t.anim).toBe("aurora-drift");
  expect(t.translate).not.toBe("none");
});

test("Neon: przypięcie notatki rozbłyskuje przypięte kafle (sygnał pin)", async ({ page }) => {
  await open(page, "neon");
  const title = `Neon-pin ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  await page.getByRole("article", { name: title }).hover();
  await page.getByRole("button", { name: "Przypnij" }).first().click({ force: true });
  const info = await page.locator(".note-card[data-pinned]").first().evaluate((el) => ({
    sig: document.documentElement.dataset.sig,
    anim: getComputedStyle(el, "::before").animationName,
  }));
  expect(info.sig).toBe("pin");
  expect(info.anim).toBe("neon-pin");
});

test("Plan: zaznaczony kafel dostaje linię wymiarową, która się rysuje", async ({ page }) => {
  await open(page, "plan");
  const title = `Plan-wymiar ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByText("Zapisz notatkę...")).toBeVisible();

  const card = page.getByRole("article", { name: title });
  // Zaznaczenie w trybie zbiorczym ustawia `data-selected` (ta sama flaga, której używa `NoteCard`).
  await card.evaluate((el) => el.setAttribute("data-selected", ""));
  const anim = await card.evaluate((el) => getComputedStyle(el, "::after").animationName);
  expect(anim).toBe("plan-dimension");
});

test("Zorza: zmiana na tę skórkę wpływa falą gwiazd", async ({ page }) => {
  await open(page, "plan");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await page.locator('[data-skin-option="zorza"]').click();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-skin", "zorza");
  const info = await page.evaluate(() => ({
    sig: document.documentElement.dataset.sig,
    anim: getComputedStyle(document.querySelector(".paper-grid")!, "::before").animationName,
  }));
  expect(info.sig).toBe("skin");
  expect(info.anim).toBe("zorza-stars-in");
});

test("Zorza: fala barw przelatuje przez tło przy zapisie, a w spoczynku jest niewidoczna", async ({ page }) => {
  await open(page, "zorza");
  const layer = page.locator(".sig-layer");
  await expect(layer).toHaveCount(1);
  expect(await layer.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
  await page.evaluate(() => document.documentElement.setAttribute("data-sig", "save"));
  expect(await layer.evaluate((el) => getComputedStyle(el).animationName)).toBe("zorza-wave");
});

test("Matryca: linia skanu zjeżdża przy zapisie, a przy ograniczonym ruchu nie animuje się", async ({ page }) => {
  await open(page, "matrix");
  const layer = page.locator(".sig-layer");
  await expect(layer).toHaveCount(1);
  await page.evaluate(() => document.documentElement.setAttribute("data-sig", "save"));
  expect(await layer.evaluate((el) => getComputedStyle(el).animationName)).toBe("matrix-scan");

  await open(page, "matrix", "reduced");
  await page.evaluate(() => document.documentElement.setAttribute("data-sig", "save"));
  expect(await page.locator(".sig-layer").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});

// Równe sygnatury (plan motywów, Faza 2): `.sig-layer` jest w każdym stylu; `::after` — zapis, `::before` — widok.
async function layerAnim(page: Page, pseudo: "::before" | "::after", sig: string) {
  await page.evaluate((s) => document.documentElement.setAttribute("data-sig", s), sig);
  return page.locator(".sig-layer").evaluate((el, p) => getComputedStyle(el, p).animationName, pseudo);
}

for (const [skin, pseudo, sig, name] of [
  ["zeszyt", "::after", "save", "zeszyt-stamp"],
  ["plan", "::after", "save", "plan-measure"],
  ["plan", "::before", "view", "plan-scan"],
  ["neon", "::after", "save", "neon-buzz"],
  ["neon", "::before", "view", "neon-brownout"],
  ["miedz", "::before", "view", "miedz-sheen"],
  ["hydraulika", "::before", "view", "hydro-flow-once"],
] as const) {
  test(`${skin}: sygnał ${sig} odpala ${name}, a przy ograniczonym ruchu nic`, async ({ page }) => {
    await open(page, skin);
    await expect(page.locator(".sig-layer")).toHaveCount(1);
    expect(await layerAnim(page, pseudo, sig)).toBe(name);

    await open(page, skin, "reduced");
    expect(await layerAnim(page, pseudo, sig)).toBe("none");
  });
}

test("Zorza: fala zapisu naprawdę przelatuje przez ekran (nie zostaje poza nim)", async ({ page }) => {
  await open(page, "zorza");
  await page.evaluate(() => document.documentElement.setAttribute("data-sig", "save"));
  await page.waitForTimeout(900);
  const s = await page.locator(".sig-layer").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: Number(cs.opacity), transform: cs.transform };
  });
  expect(s.opacity).toBeGreaterThan(0.2);
  // Połowa przelotu: przesunięcie w poziomie mniejsze niż szerokość ekranu (nie -100%).
  const tx = Number(s.transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+)/)?.[1] ?? "NaN");
  expect(Math.abs(tx)).toBeLessThan(await page.evaluate(() => window.innerWidth));
});

test("Hydraulika: kafel ma śrubki obejmy; Miedź: patyna tylko na starej notatce", async ({ page }) => {
  await open(page, "hydraulika");
  const title = `Hydro-obejma ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zapisz", exact: true }).click();
  const card = page.getByRole("article", { name: title });
  expect(await card.evaluate((el) => getComputedStyle(el, "::after").backgroundImage)).toContain("radial-gradient");

  await open(page, "miedz");
  const fresh = page.getByRole("article", { name: title });
  expect(await fresh.getAttribute("data-aged")).toBeNull();
  await fresh.evaluate((el) => el.setAttribute("data-aged", "true"));
  expect(await fresh.evaluate((el) => getComputedStyle(el, "::after").boxShadow)).toContain("inset");
});
