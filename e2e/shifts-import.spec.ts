import { test, expect, type Page } from "@playwright/test";

// Import zmian z pliku w ustawieniach Grafiku (E3): podgląd dzień po dniu, zapis, Cofnij.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-28T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/grafik");
});

const day = (n: number, rest: string) => new RegExp(`^${n} [a-ząćęłńóśźż]+, [a-ząćęłńóśźż]+, ${rest}`);

/** Otwiera ustawienia Grafiku i zwraca sekcję importu. */
async function importSection(page: Page) {
  await page.getByRole("button", { name: "Ustawienia grafiku" }).click();
  const dialog = page.getByRole("dialog", { name: "Ustawienia grafiku" });
  await expect(dialog).toBeVisible();
  return dialog.getByRole("region", { name: "Import zmian z pliku" });
}

test("CSV z karty czasu: podgląd dzień po dniu, zapis, a potem Cofnij", async ({ page }) => {
  const section = await importSection(page);
  const csv = "Data;Zmiana;Odchylenie (min);Notatka\r\n2026-10-29;Dniówka;0;\r\n2026-10-30;Dniówka;30;szkolenie\r\n";
  await section.locator('input[type="file"]').setInputFiles({ name: "karta.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });

  await expect(section).toContainText("do wpisania 2 dni");
  await section.getByText("Podgląd dzień po dniu (2)").click();
  // Wiersze podglądu, a nie opcje listy rodzajów (te też mają tekst „Dniówka”).
  await expect(section.locator("li", { hasText: "Dniówka" })).toHaveCount(2);

  await section.getByRole("button", { name: "Importuj 2 dni" }).click();
  await expect(page.getByText("Zaimportowano 2 dni z pliku")).toBeVisible();
  // Otwarte okno ustawień chowa siatkę przed czytnikiem (aria-hidden), więc najpierw je zamykamy.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: day(30, "Dniówka") })).toBeVisible();

  await page.getByRole("button", { name: "Cofnij", exact: true }).click();
  await expect(page.getByRole("button", { name: day(30, "wolne$") })).toBeVisible();
});

test(".ics z cykliczną regułą COUNT rozwija wystąpienia do podglądu", async ({ page }) => {
  const section = await importSection(page);
  const ics = [
    "BEGIN:VCALENDAR", "BEGIN:VEVENT", "DTSTART:20261104T070000", "RRULE:FREQ=DAILY;COUNT=3", "SUMMARY:Praca", "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  await section.locator('input[type="file"]').setInputFiles({ name: "praca.ics", mimeType: "text/calendar", buffer: Buffer.from(ics, "utf8") });

  // Rodzaj domyślny to pierwsza dniówka; trzy wystąpienia, każde na swój dzień.
  await expect(section).toContainText("do wpisania 3 dni");
  await section.getByText("Podgląd dzień po dniu (3)").click();
  await expect(section.locator("li")).toHaveCount(3);
});
