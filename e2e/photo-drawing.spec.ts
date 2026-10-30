import { test, expect, type Page } from "@playwright/test";

// Rysowanie po zdjęciu we wpisie z budowy: płótno w proporcjach zdjęcia, zapis podmienia zdjęcie.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

/** Zdjęcie 4:3 narysowane w przeglądarce. */
async function photo(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400; c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "hsl(200, 70%, 50%)";
    ctx.fillRect(0, 0, 400, 300);
    return c.toDataURL("image/png").split(",")[1];
  });
  return { name: "pion.png", mimeType: "image/png", buffer: Buffer.from(b64, "base64") };
}

test("rysunek na zdjęciu: płótno w proporcjach zdjęcia, kreska, zapis podmienia zdjęcie we wpisie", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Pion przed zakryciem");
  await sheet.getByTestId("journal-photo-input").setInputFiles([await photo(page)]);
  const img = sheet.getByRole("list", { name: "Zdjęcia we wpisie" }).locator("img").first();
  await expect(img).toHaveAttribute("src", /.+/);
  const before = await img.getAttribute("src");

  await sheet.getByRole("button", { name: "Rysuj na zdjęciu" }).click();
  const canvas = page.locator("canvas.cursor-crosshair");
  await expect(canvas).toBeVisible();
  // Proporcje zdjęcia (4:3), nie okna — płótno dopasowuje się po wczytaniu zdjęcia.
  await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => Math.round((c.width / c.height) * 100) / 100)).toBe(1.33);

  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Zapisz rysunek" }).click();
  await expect(canvas).toHaveCount(0);

  await expect(sheet.getByRole("button", { name: "Usuń zdjęcie z wpisu" })).toHaveCount(1);
  await expect(img).not.toHaveAttribute("src", before!);
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
});

test("„Cofnij rysunek” przywraca oryginał zdjęcia, także po zapisie wpisu (H0.1)", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByLabel("Co się dzieje?").fill("Podejście umywalki");
  await sheet.getByTestId("journal-photo-input").setInputFiles([await photo(page)]);
  const img = sheet.getByRole("list", { name: "Zdjęcia we wpisie" }).locator("img").first();
  await expect(img).toHaveAttribute("src", /.+/);
  const before = await bytesOf(img);
  await expect(sheet.getByRole("button", { name: /Cofnij rysunek/ })).toHaveCount(0);

  await sheet.getByRole("button", { name: "Rysuj na zdjęciu" }).click();
  const canvas = page.locator("canvas.cursor-crosshair");
  await expect.poll(async () => canvas.evaluate((c: HTMLCanvasElement) => Math.round((c.width / c.height) * 100) / 100)).toBe(1.33);
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Zapisz rysunek" }).click();
  await expect(canvas).toHaveCount(0);
  await expect.poll(() => bytesOf(img)).not.toBe(before);

  // Zapis wpisu i ponowne otwarcie: oryginał nadal jest przy wpisie.
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByTestId("study-journal").getByRole("button", { name: "Opcje wpisu" }).first().click();
  await page.getByRole("menuitem", { name: "Edytuj wpis" }).click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Cofnij rysunek na zdjęciu 1" }).click();
  await expect.poll(() => bytesOf(img)).toBe(before);
  await expect(sheet.getByRole("button", { name: /Cofnij rysunek/ })).toHaveCount(0);
});

/** Odcisk bajtów zdjęcia z miniatury (adres `blob:` jest za każdym razem inny). */
async function bytesOf(img: import("@playwright/test").Locator): Promise<string> {
  return img.evaluate(async (el: HTMLImageElement) => {
    const buf = new Uint8Array(await (await fetch(el.src)).arrayBuffer());
    let h = 0;
    for (const b of buf) h = (h * 31 + b) >>> 0;
    return `${buf.length}:${h}`;
  });
}
