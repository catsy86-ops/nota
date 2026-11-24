import { test, expect } from "@playwright/test";
import { inCard, inPapiery } from "./helpers";

// R4.4 Wzorce budów: zapis z karty („Zapisz jako wzorzec”) i nowa budowa z wzorca (etapy + pomieszczenia z punktami).

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.sitePatterns.v1", JSON.stringify([
      { id: "p1", name: "Łazienka", stages: [{ id: "woda", name: "Woda" }, { id: "s-x", name: "Kotłownia" }], rooms: [{ name: "Łazienka", types: ["umywalka", "wc-stelaz"] }], created: 1 },
    ]));
  });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
});

test("nowa budowa z wzorca dostaje etapy i pomieszczenie z punktami; zapis wzorca z karty", async ({ page }) => {
  await page.getByRole("button", { name: /Nowa budowa/ }).click();
  await page.getByLabel("Nazwa budowy").fill("Polna 7");
  await page.getByLabel("Jak poprzednia budowa").selectOption({ label: "Łazienka" });
  await page.getByRole("button", { name: "Utwórz budowę" }).click();
  const card = page.getByTestId("site-card");
  await expect(card).toBeVisible();

  const stages = await inCard(card, "site-stages");
  await expect(stages).toContainText("Kotłownia");
  const points = await inCard(card, "site-points");
  await expect(points.getByTestId("site-room")).toHaveCount(1);
  await expect(points.getByTestId("site-room")).toContainText("Umywalka");

  await inPapiery(card);
  await card.getByTestId("site-pattern-open").click();
  const dialog = page.getByTestId("save-pattern");
  await dialog.getByLabel("Nazwa wzorca").fill("Kotłownia");
  await dialog.getByRole("button", { name: "Zapisz wzorzec" }).click();
  await expect(page.getByText("Zapisano wzorzec „Kotłownia”")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kaczy.study.sitePatterns.v1") ?? "[]").map((p: { name: string }) => p.name));
  expect(saved).toEqual(["Łazienka", "Kotłownia"]);

  // B3.7: „Jak poprzednia budowa” z budowy kopiuje etapy i pomieszczenia (wcześniej etapy się nie zapisywały).
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("site-card")).toHaveCount(0, { timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: /Nowa budowa/ }).first().click();
  await page.getByLabel("Nazwa budowy").fill("Lipowa 9");
  await page.getByLabel("Jak poprzednia budowa").selectOption({ label: "Polna 7" });
  await page.getByRole("button", { name: "Utwórz budowę" }).click();
  const second = page.getByTestId("site-card");
  await expect(second).toContainText("Lipowa 9");
  await expect(await inCard(second, "site-stages")).toContainText("Kotłownia");
  await expect((await inCard(second, "site-points")).getByTestId("site-room")).toHaveCount(1);
});

