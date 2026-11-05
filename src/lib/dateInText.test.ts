import { describe, expect, it } from "vitest";
import { findDateInText } from "./dateInText";

// Czwartek 5 listopada 2026, 12:00.
const NOW = new Date(2026, 10, 5, 12, 0);

describe("termin w treści notatki (Terminy 3.4)", () => {
  it("„w piątek o 10” w środku zdania", () => {
    const hit = findDateInText("Odbiór kuchni w piątek o 10, zabrać klucze", NOW)!;
    expect(hit.phrase).toBe("w piątek o 10");
    expect(hit.date).toEqual(new Date(2026, 10, 6, 10, 0));
  });

  it("„jutro 15:30” i data „12.11”", () => {
    expect(findDateInText("Dentysta jutro 15:30.", NOW)!.date).toEqual(new Date(2026, 10, 6, 15, 30));
    expect(findDateInText("Termin oddania 12.11 rano", NOW)!.phrase).toMatch(/^12\.11/);
  });

  it("zwykłe liczby i słowa nie są terminem", () => {
    expect(findDateInText("Kupić 3 worki cementu i 10 rur", NOW)).toBeNull();
    expect(findDateInText("W tym tygodniu zrobić porządek", NOW)).toBeNull();
    expect(findDateInText("", NOW)).toBeNull();
  });

  it("termin w przeszłości się nie liczy", () => {
    expect(findDateInText("Dziś o 8 było zebranie", NOW)).toBeNull();
  });
});
