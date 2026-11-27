import { test, expect } from "@playwright/test";

// Pole „Dołącz do istniejącej grupy” (Ustawienia → Sync): kratki `InputOTP`.
// Nie klikamy „Dołącz” — to łączy się z serwerami sygnalizacyjnymi.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("link ?pair= wypełnia kratki kodem", async ({ page }) => {
  await page.goto("/?pair=abcd-efgh-jkmn");
  const field = page.getByLabel("Kod z innego urządzenia");
  await expect(field).toHaveValue("ABCDEFGHJKMN");
  await expect(page.getByRole("button", { name: "Dołącz" })).toBeEnabled();
  await expect(page).not.toHaveURL(/pair=/);
});

test("link #pair= (fragment) wypełnia kratki kodem i znika z adresu (S11)", async ({ page }) => {
  await page.goto("/#pair=abcd-efgh-jkmn");
  const field = page.getByLabel("Kod z innego urządzenia");
  await expect(field).toHaveValue("ABCDEFGHJKMN");
  await expect(page).not.toHaveURL(/pair=/);
});

test("kod parowania ma 12 znaków, krótsze nie są przyjmowane, bez znaków spoza alfabetu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Sync" }).click();

  const field = page.getByLabel("Kod z innego urządzenia");
  const join = page.getByRole("button", { name: "Dołącz" });
  await field.click();
  await field.pressSequentially("abc");
  await expect(field).toHaveValue("ABC");
  await expect(join).toBeDisabled();

  // „O” i „0” nie należą do alfabetu kodu — pole ich nie przyjmuje.
  await field.pressSequentially("O0defgh");
  await expect(field).toHaveValue("ABCDEFGH");
  // Stare 8-znakowe kody są odrzucane (nazwa pokoju dawałaby się odgadnąć).
  await expect(join).toBeDisabled();

  await field.pressSequentially("jkmn");
  await expect(field).toHaveValue("ABCDEFGHJKMN");
  await expect(join).toBeEnabled();
});

test("U2.4: bez grupy dwa wybory; w grupie dołączenie zwinięte, „Odłącz” na samym dole", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?settings=sync");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Mam już grupę" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Zacznij nową grupę" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Urządzenia w grupie" })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Odłącz to urządzenie" })).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: false, code: "ABCD2345EFGH", signaling: [], legacyRoom: false, shortCodeDropped: false }));
  });
  await page.goto("/?settings=sync");
  await expect(dialog.getByRole("heading", { name: "Urządzenia w grupie" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Mam już grupę" })).toHaveCount(0);
  await expect(dialog.getByLabel("Kod z innego urządzenia")).toBeHidden();
  await dialog.getByText("Dołącz do innej grupy").click();
  await expect(dialog.getByLabel("Kod z innego urządzenia")).toBeVisible();
  // „Odłącz” jest pod całą kartą synchronizacji (niżej niż „Jak to działa”).
  const how = await dialog.getByRole("heading", { name: "Jak to działa" }).boundingBox();
  const forget = await dialog.getByRole("button", { name: "Odłącz to urządzenie" }).boundingBox();
  expect(forget!.y).toBeGreaterThan(how!.y);
});
