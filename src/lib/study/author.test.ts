import { describe, it, expect } from "vitest";
import { cleanAuthor, otherAuthor } from "./companyPrefs";
import { addShortage, cleanShortages } from "./shortages";
import { cleanPoint } from "./points";
import { cleanEntry } from "./journalEntry";

describe("autor przy wpisach, brakach i punktach (H5.1)", () => {
  it("imię bez znaków sterujących, do 40 znaków; puste = brak", () => {
    expect(cleanAuthor("  Marek  ")).toBe("Marek");
    expect(cleanAuthor("   ")).toBeUndefined();
    expect(cleanAuthor(42)).toBeUndefined();
    expect(cleanAuthor("x".repeat(60))).toHaveLength(40);
  });

  it("podpis tylko przy cudzych pozycjach", () => {
    expect(otherAuthor("Marek", "Grzegorz")).toBe("Marek");
    expect(otherAuthor("Grzegorz", "Grzegorz")).toBeUndefined();
    expect(otherAuthor(undefined, "Grzegorz")).toBeUndefined();
  });

  it("autor zostaje w wpisie, braku i punkcie po czyszczeniu", () => {
    expect(cleanEntry({ id: "e", at: 1, kind: "note", topic: null, text: "x", site: "", checked: [], images: [], by: "Marek" })?.by).toBe("Marek");
    const list = addShortage([], "Rura PEX 16", "50 m", 1, () => "s1", "Marek");
    expect(cleanShortages(list)?.[0].by).toBe("Marek");
    expect(cleanPoint({ id: "p", room: "r", type: "umywalka", sides: [], steps: {}, order: 0, by: "Marek" })?.by).toBe("Marek");
    expect(cleanPoint({ id: "p", room: "r", type: "umywalka", sides: [], steps: {}, order: 0 })).not.toHaveProperty("by");
  });
});
