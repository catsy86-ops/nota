import { test, expect } from "@playwright/test";
import { whenSaved } from "./helpers";

// Kompozytor (QoL, punkt 11): dwa szybkie zapisy nie tworzą dwóch notatek.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("dwa szybkie Ctrl+Enter zapisują jedną notatkę", async ({ page }) => {
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill("Jedna notatka");
  // Dwa naciśnięcia jedno po drugim, bez czekania na pole: po pierwszym zapisie kompozytor się zwija, a lokator
  // `getByPlaceholder` czekałby na pole, którego już nie ma (pod obciążeniem test wisiał do limitu czasu).
  await page.getByPlaceholder("Tytuł").focus();
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Enter");
  // Kafel animuje się po zapisie (może chwilowo być widoczny dwa razy) — liczymy po zapisie do bazy; `toHaveCount`
  // czeka, aż animacja zejdzie do jednego kafla, a drugi zapis zostawiłby dwa na stałe.
  await whenSaved(page);
  await expect(page.locator("[data-note-id-wrap]", { hasText: "Jedna notatka" })).toHaveCount(1);
});
