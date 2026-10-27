import { test, expect } from "@playwright/test";

// Kod wyglądu (plan motywów 3.5): skopiowany na jednym urządzeniu przenosi styl, akcent i kształt na drugie.
test("kod wyglądu przenosi styl, akcent i kształt do innej przeglądarki", async ({ browser }) => {
  const a = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const pa = await a.newPage();
  await pa.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.skin.v1", JSON.stringify("kafle"));
    localStorage.setItem("kaczy.accent.v1", JSON.stringify({ kafle: 3 }));
    localStorage.setItem("kaczy.shape.v1", JSON.stringify("soft"));
  });
  await pa.goto("/");
  await pa.getByRole("button", { name: "Ustawienia" }).first().click();
  await pa.getByRole("tab", { name: "Wygląd" }).click();
  await pa.getByRole("button", { name: "Kopiuj kod wyglądu" }).click();
  const code = await pa.evaluate(() => navigator.clipboard.readText());
  expect(code).toMatch(/^NOTKI1-/);
  await a.close();

  const b = await browser.newContext();
  const pb = await b.newPage();
  await pb.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await pb.goto("/");
  await expect(pb.locator("html")).toHaveAttribute("data-skin", "zeszyt");
  await pb.getByRole("button", { name: "Ustawienia" }).first().click();
  await pb.getByRole("tab", { name: "Wygląd" }).click();
  await pb.getByLabel("Kod wyglądu").fill(code);
  await pb.getByRole("button", { name: "Wczytaj" }).click();
  const html = pb.locator("html");
  await expect(html).toHaveAttribute("data-skin", "kafle");
  await expect(html).toHaveAttribute("data-accent", "3");
  await expect(html).toHaveAttribute("data-shape", "soft");
  await b.close();
});
