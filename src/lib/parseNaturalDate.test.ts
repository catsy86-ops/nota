import { describe, it, expect } from "vitest";
import { parseNaturalDate } from "./parseNaturalDate";

const NOW = new Date(2026, 8, 24, 10, 0, 0, 0); // czwartek, 2026-09-24 10:00

describe("parseNaturalDate", () => {
  it("parsuje 'jutro' z godzina", () => {
    const d = parseNaturalDate("jutro 15:00", NOW);
    expect(d?.getDate()).toBe(25);
    expect(d?.getHours()).toBe(15);
    expect(d?.getMinutes()).toBe(0);
  });

  it("parsuje 'jutro' bez godziny (domyslnie 9:00)", () => {
    const d = parseNaturalDate("jutro", NOW);
    expect(d?.getDate()).toBe(25);
    expect(d?.getHours()).toBe(9);
  });

  it("parsuje 'za 2h'", () => {
    const d = parseNaturalDate("za 2h", NOW);
    expect(d?.getHours()).toBe(12);
  });

  it("parsuje 'za 30 min'", () => {
    const d = parseNaturalDate("za 30 min", NOW);
    expect(d?.getHours()).toBe(10);
    expect(d?.getMinutes()).toBe(30);
  });

  it("parsuje 'za 3 dni'", () => {
    const d = parseNaturalDate("za 3 dni", NOW);
    expect(d?.getDate()).toBe(27);
  });

  it("parsuje 'dzis 18:30'", () => {
    const d = parseNaturalDate("dzis 18:30", NOW);
    expect(d?.getDate()).toBe(24);
    expect(d?.getHours()).toBe(18);
    expect(d?.getMinutes()).toBe(30);
  });

  it("parsuje 'pojutrze'", () => {
    const d = parseNaturalDate("pojutrze", NOW);
    expect(d?.getDate()).toBe(26);
  });

  it("parsuje nazwe dnia tygodnia — najblizszy przyszly", () => {
    const d = parseNaturalDate("poniedzialek 9:00", NOW); // NOW to czwartek -> najblizszy poniedzialek
    expect(d?.getDay()).toBe(1);
    expect(d!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("parsuje sama godzine w przyszlosci jako dzisiaj", () => {
    const d = parseNaturalDate("14:00", NOW);
    expect(d?.getDate()).toBe(24);
    expect(d?.getHours()).toBe(14);
  });

  it("parsuje sama godzine w przeszlosci jako jutro", () => {
    const d = parseNaturalDate("08:00", NOW);
    expect(d?.getDate()).toBe(25);
    expect(d?.getHours()).toBe(8);
  });

  it("zwraca null dla nierozpoznanego tekstu", () => {
    expect(parseNaturalDate("cos losowego", NOW)).toBeNull();
  });

  it("zwraca null dla pustego tekstu", () => {
    expect(parseNaturalDate("", NOW)).toBeNull();
  });

  it("zwraca null dla niepoprawnej godziny", () => {
    expect(parseNaturalDate("jutro 25:00", NOW)).toBeNull();
  });
});
