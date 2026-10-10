import { test, expect, type Page } from "@playwright/test";

/** Stary zapis Grafiku (localStorage) — trafia do dokumentu przy pierwszym wczytaniu. */
async function seed(page: Page, data: object) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem("legacy-seeded")) return;
    sessionStorage.setItem("legacy-seeded", "1");
    localStorage.setItem("kaczy:shifts", json);
  }, JSON.stringify({ version: 2, ...data }));
  await page.goto("/grafik");
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:00:00"));
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

const DAYS = {
  // Urlop: pon–śr (do dziś włącznie), czw–pt (zaplanowane), marzec; sobota poza pulą.
  "2026-10-05": { type: "u" }, "2026-10-06": { type: "u" }, "2026-10-07": { type: "u" },
  "2026-10-08": { type: "u" }, "2026-10-09": { type: "u" }, "2026-10-10": { type: "u" },
  "2026-03-10": { type: "u" },
  "2026-03-16": { type: "l4" },
  "2026-01-05": { type: "d" },
};

test("licznik urlopu liczy wykorzystane, zaplanowane i pozostałe, a wymiar zmienia się w ustawieniach", async ({ page }) => {
  await seed(page, { days: DAYS });
  const meter = page.getByRole("region", { name: "Licznik urlopu 2026" });
  await expect(meter).toContainText("zostało 14 z 20 dni");
  await expect(meter).toContainText("wykorzystane 4 · zaplanowane 2");

  await page.getByRole("button", { name: "Ustawienia grafiku" }).click();
  const settings = page.getByRole("dialog", { name: "Ustawienia grafiku" });
  await settings.getByRole("button", { name: "26", exact: true }).click();
  await expect(settings.getByLabel("Roczny wymiar urlopu")).toHaveValue("26");
  await page.keyboard.press("Escape");
  await expect(meter).toContainText("zostało 20 z 26 dni");

  // Wymiar przeżywa odświeżenie.
  await page.reload();
  await expect(page.getByRole("region", { name: "Licznik urlopu 2026" })).toContainText("zostało 20 z 26 dni");
});

test("podsumowanie roku pokazuje miesiące, sumę i przełącza rok", async ({ page }) => {
  await seed(page, { days: DAYS, hourlyRate: 30 });
  await page.getByRole("button", { name: "Podsumowanie roku" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Rok 2026");

  const table = dialog.getByRole("table", { name: "Podsumowanie roku 2026 według miesięcy" });
  await expect(table.getByRole("row")).toHaveCount(14); // nagłówek + 12 miesięcy + razem
  const total = table.getByRole("row").last();
  // Godz. 8 (jedna zmiana), urlop 6, L4 1, zarobek 8 h × 30 zł.
  await expect(total).toContainText("8");
  await expect(total.getByRole("cell").nth(3)).toHaveText("6");
  await expect(total.getByRole("cell").nth(4)).toHaveText("1");
  await expect(total.getByRole("cell").nth(5)).toContainText("240,00");
  await expect(table.getByRole("row", { name: /^paź/ })).toHaveAttribute("aria-current", "date");

  await dialog.getByRole("button", { name: "Poprzedni rok" }).click();
  await expect(dialog).toContainText("Rok 2025");
  await expect(dialog.getByRole("region", { name: "Licznik urlopu 2025" })).toContainText("zostało 20 z 20 dni");
});

test("podsumowanie roku nie przewija się poziomo na telefonie", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, { days: DAYS, hourlyRate: 30 });
  await page.getByRole("button", { name: "Podsumowanie roku" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Rok 2026");
  const overflow = await dialog.evaluate((el) => ({ dialog: el.scrollWidth - el.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  expect(overflow.dialog).toBeLessThanOrEqual(0);
  expect(overflow.page).toBeLessThanOrEqual(0);
});

test("jawny rodzaj nieobecności decyduje o liczniku urlopu, niezależnie od nazwy", async ({ page }) => {
  await seed(page, { types: [
    { id: "w", name: "Wolne płatne", short: "W", color: "#10b981", start: "08:00", end: "16:00", breakMin: 0, kind: "absence", absenceKind: "leave" },
    { id: "k", name: "Kurs", short: "K", color: "#64748b", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
  ], days: { "2026-10-05": { type: "w" }, "2026-10-06": { type: "k" } } });
  await expect(page.getByRole("region", { name: "Licznik urlopu 2026" })).toContainText("zostało 19 z 20 dni");
});
