import { test, expect, type Page } from "@playwright/test";

// Udostępnienie zdjęć z aparatu do wpisu z budowy (H4.1). Ta sama droga co w `share-files.spec.ts`:
// formularz POST na /share przechwytuje service worker. Praca jest w użyciu (budowa z wpisem),
// więc dymek pyta: „Wpis z budowy” czy „Notatka”.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: Date.now() - 86_400_000, kind: "ok", topic: null, text: "Podejścia", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.goto("/");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
});

/** Udostępnia `n` różnych zdjęć (każde w innym kolorze — inny skrót, bez scalania duplikatów). */
async function shareImages(page: Page, n: number) {
  await page.evaluate(async (count) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/share";
    form.enctype = "multipart/form-data";
    const file = document.createElement("input");
    file.type = "file";
    file.name = "files";
    const dt = new DataTransfer();
    for (let i = 0; i < count; i++) {
      const c = document.createElement("canvas");
      c.width = 40; c.height = 30;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = `hsl(${i * 40}, 70%, 50%)`;
      ctx.fillRect(0, 0, 40, 30);
      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
      dt.items.add(new File([blob], `zdjecie-${i}.png`, { type: "image/png" }));
    }
    file.files = dt.files;
    form.append(file);
    document.body.append(form);
    form.submit();
  }, n);
}

test("7 zdjęć → „Wpis z budowy”: 5 w arkuszu z bieżącą budową, reszta w kolejnym wpisie", async ({ page }) => {
  await shareImages(page, 7);
  const choice = page.locator("[data-sonner-toast]").filter({ hasText: "Zapisać 7 zdjęć jako…" });
  await expect(choice).toContainText("Wpis z budowy: Lipowa 5");
  await choice.getByRole("button", { name: "Wpis z budowy" }).click();

  await expect(page).toHaveURL(/\/praca/);
  const sheet = page.getByTestId("journal-entry-sheet");
  await expect(sheet.getByRole("list", { name: "Zdjęcia we wpisie" }).locator("img")).toHaveCount(5);
  // Komunikat u góry — nie zasłania „Zapisz wpis” na dole arkusza.
  await expect(page.getByText("Reszta zdjęć zapisana w kolejnym wpisie")).toBeVisible();

  await sheet.getByLabel("Co się dzieje?").fill("Piony przed zakryciem");
  await sheet.getByRole("button", { name: "Zapisz wpis" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId("study-journal").getByText("Piony przed zakryciem")).toBeVisible();
  // Wpis z resztą zdjęć (2) i wpis z arkusza (5) — oba na Lipowej.
  await expect(page.getByTestId("study-journal").getByRole("list", { name: "Zdjęcia wpisu" })).toHaveCount(2);
});

test("„Notatka” zapisuje zdjęcia jak dotąd", async ({ page }) => {
  await shareImages(page, 2);
  const choice = page.locator("[data-sonner-toast]").filter({ hasText: "Zapisać 2 zdjęć jako…" });
  await choice.getByRole("button", { name: "Notatka" }).click();
  await expect(page.getByText("Zapisano w NOTKACH")).toBeVisible();
  await expect(page.locator("[data-note-id]")).toHaveCount(1);
});
