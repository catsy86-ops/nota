import { test, expect } from "@playwright/test";
import { SHIFT_TEST_TYPES, withLegacyShifts } from "./helpers/shiftSeed";

// G4.1: „Skończyłem” z powiadomienia o końcu zmiany. Przy zamkniętej aplikacji worker otwiera
// `/grafik?akcja=shift-done&dzien=…`; aplikacja zapisuje koniec tak jak „Skończyłem teraz” i zdejmuje parametry.

test("przy zamkniętej aplikacji „Skończyłem” zapisuje koniec zmiany i czyści adres", async ({ page }) => {
  // Zmiana „Dzień” (06–14), zegar po jej końcu: odchylenie +30 min.
  await page.clock.setFixedTime(new Date(2026, 10, 6, 14, 30).getTime());
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await withLegacyShifts(page, { types: SHIFT_TEST_TYPES, days: { "2026-11-06": { type: "d" } } }, "shift-end-seed");

  await page.goto("/grafik?akcja=shift-done&dzien=2026-11-06");
  await expect(page.getByText(/Zakończono zmianę/)).toBeVisible();
  await expect(page).not.toHaveURL(/akcja=/);
});
