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
