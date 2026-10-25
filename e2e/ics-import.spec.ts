import { test, expect } from "@playwright/test";

// Import przypomnień z pliku .ics (QoL): wybrany plik zapisuje się jako notatki z terminem.

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "DTSTART:20261020T093000",
  "SUMMARY:Dentysta",
  "RRULE:FREQ=WEEKLY",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART:20261001T090000",
  "SUMMARY:Stare wydarzenie",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");
});

test("import .ics: przyszłe wydarzenie staje się notatką z powtarzaniem, minione są pomijane", async ({ page }) => {
  await page.evaluate(() => window.dispatchEvent(new Event("kaczy:import-external")));
  await page.locator('input[type="file"]').first().setInputFiles({ name: "kalendarz.ics", mimeType: "text/calendar", buffer: Buffer.from(ICS) });
  await expect(page.getByText("Dodano przypomnienia: 1")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dentysta" })).toBeVisible();
  await expect(page.getByText("Stare wydarzenie")).toHaveCount(0);
});
