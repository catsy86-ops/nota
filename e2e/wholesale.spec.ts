import { test, expect } from "@playwright/test";

// H1.4 Jedna lista do hurtowni: materiał ze wszystkich budów w grupach, „Oznacz wszystko jako zamówione” z „Cofnij”.

test("lista do hurtowni: dwie budowy w grupach, oznaczenie wszystkiego i „Cofnij” @mobile", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 2, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    const at = (h: number) => new Date(2026, 10, 1, h).getTime();
    const e = (id: string, h: number, site: string, fittings: { name: string; qty: number }[]) => ({ id, at: at(h), kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [], fittings });
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      journal: [e("a", 9, "Lipowa 5", [{ name: "Kolano 16", qty: 4 }]), e("b", 11, "Polna 3", [{ name: "Trójnik 20", qty: 2 }])],
    }));
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/praca");
  await page.getByRole("tab", { name: "Dziennik" }).click();
  const open = page.getByTestId("wholesale-open");
  await expect(open).toContainText("Do hurtowni (2)");
  const dialog = page.getByTestId("wholesale-dialog");
  await expect(async () => {
    await open.click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(dialog.getByTestId("wholesale-group")).toHaveCount(2);
  await expect(dialog.getByRole("region", { name: "Na budowę: Lipowa 5" })).toContainText("Kolano 16");
  await expect(dialog.getByRole("region", { name: "Na budowę: Polna 3" })).toContainText("Trójnik 20");

  await dialog.getByRole("button", { name: "Oznacz wszystko jako zamówione" }).click();
  await expect(page.getByText("Zamówione: 2 budowy")).toBeVisible();
  await expect(open).toHaveCount(0);
  await page.getByRole("button", { name: "Cofnij" }).click();
  await expect(open).toContainText("Do hurtowni (2)");
});
