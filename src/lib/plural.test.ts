import { describe, expect, it } from "vitest";
import { dniPl, godzinPl, pluralPl } from "./plural";

const F: [string, string, string] = ["notatka", "notatki", "notatek"];

describe("pluralPl", () => {
  it.each([
    [0, "notatek"], [1, "notatka"], [2, "notatki"], [4, "notatki"], [5, "notatek"],
    [12, "notatek"], [14, "notatek"], [22, "notatki"], [25, "notatek"], [112, "notatek"], [123, "notatki"],
  ])("%i → %s", (n, want) => expect(pluralPl(n, F)).toBe(want));
});

describe("odmiana w ustawieniach", () => {
  it("dni: 1 dzień, reszta dni", () => {
    expect(dniPl(1)).toBe("1 dzień");
    expect(dniPl(2)).toBe("2 dni");
    expect(dniPl(5)).toBe("5 dni");
    expect(dniPl(12)).toBe("12 dni");
    expect(dniPl(22)).toBe("22 dni");
  });

  it("godziny w bierniku: 1 godzinę, 2–4 godziny, reszta godzin (22 — godziny)", () => {
    expect(godzinPl(1)).toBe("1 godzinę");
    expect(godzinPl(2)).toBe("2 godziny");
    expect(godzinPl(4)).toBe("4 godziny");
    expect(godzinPl(5)).toBe("5 godzin");
    expect(godzinPl(12)).toBe("12 godzin");
    expect(godzinPl(22)).toBe("22 godziny");
    expect(godzinPl(23)).toBe("23 godziny");
  });
});
