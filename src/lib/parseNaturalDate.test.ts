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

describe("parseNaturalDate: godzina bez minut, dziś bez godziny, za tydzień (QoL)", () => {
  const now = new Date(2026, 9, 14, 12, 30);
  it("„jutro 15” to 15:00 następnego dnia, nie 9:00", () => {
    expect(parseNaturalDate("jutro 15", now)).toEqual(new Date(2026, 9, 15, 15, 0));
  });
  it("„dziś” bez godziny to najbliższa pełna godzina w przyszłości", () => {
    expect(parseNaturalDate("dziś", now)).toEqual(new Date(2026, 9, 14, 13, 0));
  });
  it("„za tydzień” to siedem dni później o tej samej porze", () => {
    expect(parseNaturalDate("za tydzień", now)).toEqual(new Date(2026, 9, 21, 12, 30));
  });
  it("„za 2h” nadal działa, a liczba bez kontekstu nie daje godziny", () => {
    expect(parseNaturalDate("za 2h", now)).toEqual(new Date(2026, 9, 14, 14, 30));
    expect(parseNaturalDate("kupić 3 jajka", now)).toBeNull();
  });
});

describe("parseNaturalDate — tabela z planu Terminów 1.3", () => {
  // Poniedziałek 19.10.2026, 12:00.
  const now = new Date(2026, 9, 19, 12, 0, 0, 0);
  const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime();
  const cases: [string, number | null][] = [
    ["12.11", at(2026, 11, 12)],
    ["12.11 15:30", at(2026, 11, 12, 15, 30)],
    ["12.11.2026", at(2026, 11, 12)],
    ["12/11", at(2026, 11, 12)],
    ["12 listopada", at(2026, 11, 12)],
    ["2026-11-12", at(2026, 11, 12)],
    ["01.10", at(2027, 10, 1)],
    ["31.02", null],
    ["15.30", null],
    ["w piatek", at(2026, 10, 23)],
    ["we srode 10:00", at(2026, 10, 21, 10, 0)],
    ["w przyszly poniedzialek", at(2026, 10, 26)],
    ["jutro rano", at(2026, 10, 20)],
    ["dzis wieczorem", at(2026, 10, 19, 18, 0)],
    ["w piatek po poludniu", at(2026, 10, 23, 15, 0)],
    ["za godzine", at(2026, 10, 19, 13, 0)],
    ["o 15", at(2026, 10, 19, 15, 0)],
    ["o 9", at(2026, 10, 20, 9, 0)],
  ];
  it.each(cases)("%s", (input, expected) => {
    const got = parseNaturalDate(input, now);
    expect(got ? got.getTime() : null).toBe(expected);
  });
});
