import type { Page } from "@playwright/test";
import { TEST_SHIFT_TYPES } from "../../src/lib/shifts/testShiftTypes";

/**
 * Rodzaje, na których pisano testy Grafiku: Dzień (06–14), Popołudnie, Noc (22–06) i startowe.
 * Domyślny zestaw aplikacji zmienił się 2026-10-27 (bez Dnia i Nocy), więc testy dostają
 * ten sam zestaw co testy jednostkowe.
 */
export const SHIFT_TEST_TYPES = TEST_SHIFT_TYPES;

/** Zapisane cykle, na których stoją testy cykli (pierwszy: 2× Dzień, 2× Noc, 4× wolne). Dawniej były w domyślnych. */
export const SHIFT_TEST_PATTERNS = [
  { id: "c-trzyzmianowy", name: "Trzyzmianowy", steps: ["d", "d", "n", "n", null, null, null, null] },
  { id: "c-dniowka", name: "Dniówki", steps: ["d", null, null, null, null, null, null] },
];

/**
 * Stary zapis Grafiku (sprzed Yjs) — trafia do dokumentu przy pierwszym wczytaniu i otwiera /grafik.
 * `guard` odróżnia seed bazowy (z `beforeEach`) od seedu konkretnego testu, który go nadpisuje.
 */
export async function withLegacyShifts(page: Page, data: object, guard = "legacy-seeded") {
  await page.addInitScript(([json, key]) => {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    localStorage.setItem("kaczy:shifts", json);
  }, [JSON.stringify({ version: 2, ...data }), guard] as const);
  await page.goto("/grafik");
}
