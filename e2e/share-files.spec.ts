import { test, expect } from "@playwright/test";

// Udostępnienie z plikiem idzie POST-em multipart na /share, który przechwytuje
// service worker (public/sw-share.js) i odkłada dane do cache. Formularz wysłany
// nawigacją z tej samej strony przechodzi tą samą drogą co „Udostępnij” z systemu.
test("udostępnienie z PDF-em trafia do załącznika notatki przez service worker", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/share";
    form.enctype = "multipart/form-data";
    for (const [name, value] of [["title", "Faktura maj"], ["text", "Do zapłaty do piątku"]]) {
      const input = document.createElement("input");
      input.name = name;
      input.value = value;
      form.append(input);
    }
    const file = document.createElement("input");
    file.type = "file";
    file.name = "files";
    const dt = new DataTransfer();
    dt.items.add(new File(["%PDF-1.4 test"], "faktura-maj.pdf", { type: "application/pdf" }));
    file.files = dt.files;
    form.append(file);
    document.body.append(form);
    form.submit();
  });

  // S6: udostępnione pliki zapisują się dopiero po „Zapisz”.
  await page.locator("[data-sonner-toast]").filter({ hasText: "Zapisać udostępnione w NOTKACH?" }).getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByText("Zapisano w NOTKACH")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  const card = page.locator("[data-note-id]").filter({ hasText: "Faktura maj" });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.getByText("faktura-maj.pdf").first()).toBeVisible();

  // Wpis w cache jest kasowany po odebraniu, żeby nie zostawał na zawsze.
  const left = await page.evaluate(async () => (await caches.open("share-inbox-v1")).keys());
  expect(left.filter((r) => r.url.includes("/share-inbox/"))).toHaveLength(0);
});

test("udostępnione zdjęcie trafia do obrazów notatki, nie do załączników", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  // 1×1 PNG — najmniejszy poprawny obraz.
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  await page.evaluate((b64) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/share";
    form.enctype = "multipart/form-data";
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Zdjęcie z budowy";
    form.append(title);
    const file = document.createElement("input");
    file.type = "file";
    file.name = "files";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "zdjecie.png", { type: "image/png" }));
    file.files = dt.files;
    form.append(file);
    document.body.append(form);
    form.submit();
  }, png);

  // S6: udostępnione pliki zapisują się dopiero po „Zapisz”.
  await page.locator("[data-sonner-toast]").filter({ hasText: "Zapisać udostępnione w NOTKACH?" }).getByRole("button", { name: "Zapisz" }).click();
  await expect(page.getByText("Zapisano w NOTKACH")).toBeVisible();
  const card = page.locator("[data-note-id]").filter({ hasText: "Zdjęcie z budowy" });
  await expect(card).toHaveCount(1);
  await expect(card.locator("img")).toHaveCount(1);
  // Obraz nie jest załącznikiem.
  await expect(card.getByText("zdjecie.png")).toHaveCount(0);
});

// Plan-nowy 1.8: formularz z obcej strony (nagłówek Origin innej domeny) nie może dopisać notatki
// ani zostawić plików w cache. Obca strona to adres podstawiony przez `page.route`.
test("POST na /share z obcej strony nie zapisuje niczego", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const origin = new URL(page.url()).origin;

  await page.route("http://obca.test/**", (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Obca</title><body></body>" }));
  await page.goto("http://obca.test/");
  await page.evaluate((target) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = target + "/share";
    form.enctype = "multipart/form-data";
    const input = document.createElement("input");
    input.name = "title";
    input.value = "Obcy formularz";
    form.append(input);
    const file = document.createElement("input");
    file.type = "file";
    file.name = "files";
    const dt = new DataTransfer();
    dt.items.add(new File(["%PDF-1.4 obcy"], "obcy.pdf", { type: "application/pdf" }));
    file.files = dt.files;
    form.append(file);
    document.body.append(form);
    form.submit();
  }, origin);

  await page.waitForURL((u) => u.origin === origin);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("[data-note-id]").filter({ hasText: "Obcy formularz" })).toHaveCount(0);
  const left = await page.evaluate(async () => (await (await caches.open("share-inbox-v1")).keys()).map((r) => r.url));
  expect(left.filter((u) => u.includes("/share-inbox/"))).toEqual([]);
});

// S6 (audyt 2026-11-11): „Pomiń” nie zapisuje niczego — formularz z obcej strony nie dopisze notatki sam.
test("udostępnienie z plikiem: „Pomiń” nie tworzy notatki", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/share";
    form.enctype = "multipart/form-data";
    const title = document.createElement("input");
    title.name = "title";
    title.value = "Obca notatka";
    form.append(title);
    const file = document.createElement("input");
    file.type = "file";
    file.name = "files";
    const dt = new DataTransfer();
    dt.items.add(new File(["%PDF-1.4 test"], "obcy.pdf", { type: "application/pdf" }));
    file.files = dt.files;
    form.append(file);
    document.body.append(form);
    form.submit();
  });

  const ask = page.locator("[data-sonner-toast]").filter({ hasText: "Zapisać udostępnione w NOTKACH?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Pomiń" }).click();
  await expect(ask).toHaveCount(0);
  await expect(page.locator("[data-note-id]").filter({ hasText: "Obca notatka" })).toHaveCount(0);
  await expect(page.getByText("Zapisano w NOTKACH")).toHaveCount(0);
});
