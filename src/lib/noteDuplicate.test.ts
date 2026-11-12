import { describe, expect, it } from "vitest";
import { findTitleDuplicate, titleKey } from "./noteDuplicate";

const notes = [
  { id: "a", title: "Zakupy, sobota!" },
  { id: "b", title: "Łódź — wyjazd" },
  { id: "c", title: "Kosz", trashed: true },
];

describe("podpowiedź duplikatu (Notatki 3.5)", () => {
  it("klucz tytułu: bez ogonków, wielkości liter i interpunkcji", () => {
    expect(titleKey("  Łódź — WYJAZD ")).toBe("lodz wyjazd");
  });

  it("znajduje notatkę o tym samym tytule; krótkie tytuły, kosz i inne tytuły nie są duplikatem", () => {
    expect(findTitleDuplicate("zakupy sobota", notes)?.id).toBe("a");
    expect(findTitleDuplicate("lodz wyjazd", notes)?.id).toBe("b");
    expect(findTitleDuplicate("kosz", notes)).toBeNull();
    expect(findTitleDuplicate("Za", notes)).toBeNull();
    expect(findTitleDuplicate("zakupy niedziela", notes)).toBeNull();
  });
});
