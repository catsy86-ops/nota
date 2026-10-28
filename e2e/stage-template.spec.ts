import { test, expect } from "@playwright/test";

// P2.9: po przypięciu etapu wpis podsuwa listę kontrolną i zdjęcia; punkt dopisuje „✓ …” do opisu.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 14, 12, 0).getTime());
  await page.addInitScript(() => {
    localStorage.setItem("kaczy.tour.seen.v1", "1");
    localStorage.setItem("kaczy.study.tab.v1", "journal");
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("kaczy.study.v1", JSON.stringify({
      site: "Lipowa 5",
      journal: [{ id: "a", at: new Date(2026, 9, 14, 9).getTime(), kind: "ok", topic: null, text: "Start", site: "Lipowa 5", checked: [], images: [] }],
    }));
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test("szablon etapu: lista kontrolna przełącza linię w opisie, widać podpowiedź zdjęć", async ({ page }) => {
  await page.goto("/praca");
  await page.getByRole("button", { name: /^(Wpis|Dokończ wpis)$/ }).click();
  const sheet = page.getByTestId("journal-entry-sheet");
  await sheet.getByRole("radio", { name: "Zrobione" }).click();
  await sheet.getByRole("button", { name: "Odhacz etap: Kanalizacja podposadzkowa" }).click();

  const tpl = sheet.getByTestId("journal-stage-template");
  await expect(tpl).toContainText("Zdjęcia: Przebieg rur przed zasypaniem");
  const item = tpl.getByRole("button", { name: "Spadek przewodów min. 2%" });
  await item.click();
  await expect(item).toHaveAttribute("aria-pressed", "true");
  const text = sheet.getByLabel("Co się dzieje?");
  await expect(text).toHaveValue(/✓ Spadek przewodów min\. 2%/);

  await tpl.getByRole("button", { name: "✓ Spadek przewodów min. 2%" }).click();
  await expect(text).not.toHaveValue(/✓ Spadek/);
});
