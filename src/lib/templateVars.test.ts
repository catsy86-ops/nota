import { describe, expect, it } from "vitest";
import { isoWeek, renderTemplate } from "@/lib/templateVars";

const NOW = new Date(2026, 9, 12, 14, 5); // poniedziałek 12.10.2026

describe("renderTemplate", () => {
  it("podstawia zmienne daty i godziny", () => {
    expect(renderTemplate("{{data_iso}} {{godzina}} {{rok}}", NOW)).toBe("2026-10-12 14:05 2026");
    expect(renderTemplate("{{dzień}}", NOW)).toBe("poniedziałek");
    expect(renderTemplate("{{data}}", NOW)).toContain("12");
  });

  it("jutro i wczoraj przechodzą przez granicę miesiąca", () => {
    const edge = new Date(2026, 9, 31, 9, 0);
    expect(renderTemplate("{{jutro}}", edge)).toContain("1 listopada");
    expect(renderTemplate("{{wczoraj}}", edge)).toContain("30 października");
  });

  it("ignoruje wielkość liter i spacje, a nieznanej zmiennej nie rusza", () => {
    expect(renderTemplate("{{ ROK }} {{nieznana}}", NOW)).toBe("2026 {{nieznana}}");
  });

  it("numer tygodnia ISO", () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(NOW)).toBe(42);
  });
});
