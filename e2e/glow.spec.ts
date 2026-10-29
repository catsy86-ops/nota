import { test, expect } from "@playwright/test";

// Poświaty: siła i barwa w Ustawieniach → Wygląd. Wybór działa na <html> i zostaje po odświeżeniu.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
});

const style = (page: import("@playwright/test").Page, prop: string) =>
  page.evaluate((p) => document.documentElement.style.getPropertyValue(p), prop);

test("siła i barwa poświaty zmieniają zmienne CSS i zostają po odświeżeniu", async ({ page }) => {
  const strength = page.getByRole("radiogroup", { name: "Siła poświaty" }).or(page.getByRole("group", { name: "Siła poświaty" }));
  await strength.getByRole("radio", { name: "Mocna" }).or(strength.getByRole("button", { name: "Mocna" })).first().click();
  await expect.poll(() => style(page, "--glow-mul")).toBe("1.6");

  await strength.getByRole("radio", { name: "Wyłączona" }).or(strength.getByRole("button", { name: "Wyłączona" })).first().click();
  await expect.poll(() => style(page, "--glow-mul")).toBe("0");
  await expect.poll(() => style(page, "--glow-primary")).toBe("none");

  const color = page.getByRole("radiogroup", { name: "Barwa poświaty" });
  await color.getByRole("radio", { name: "Błękit" }).click();
  await expect.poll(() => style(page, "--glow-color")).toBe("#3b82f6");

  await page.reload();
  await page.getByRole("button", { name: "Ustawienia" }).first().click();
  await page.getByRole("tab", { name: "Wygląd" }).click();
  await expect.poll(() => style(page, "--glow-mul")).toBe("0");
  await expect.poll(() => style(page, "--glow-color")).toBe("#3b82f6");

  // „Zwykła” i „Motyw” zdejmują nadpisania, wracamy do skórki.
  await page.getByRole("radiogroup", { name: "Barwa poświaty" }).getByRole("radio", { name: "Motyw" }).click();
  const back = page.getByRole("radiogroup", { name: "Siła poświaty" }).or(page.getByRole("group", { name: "Siła poświaty" }));
  await back.getByRole("radio", { name: "Zwykła" }).or(back.getByRole("button", { name: "Zwykła" })).first().click();
  await expect.poll(() => style(page, "--glow-mul")).toBe("");
  await expect.poll(() => style(page, "--glow-color")).toBe("");
  await expect.poll(() => style(page, "--glow-primary")).toBe("");
});
