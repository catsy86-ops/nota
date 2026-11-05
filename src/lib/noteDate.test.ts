import { describe, expect, it } from "vitest";
import { formatNoteDate } from "./noteDate";

const now = new Date(2026, 10, 5, 15, 40); // 5 listopada 2026, 15:40

describe("formatNoteDate (plan nowy 3.1)", () => {
  it("ten sam dzień: „dziś” i godzina", () => {
    expect(formatNoteDate(new Date(2026, 10, 5, 12, 0).getTime(), now)).toBe("dziś 12:00");
  });
  it("dzień wcześniej: „wczoraj” i godzina", () => {
    expect(formatNoteDate(new Date(2026, 10, 4, 18, 30).getTime(), now)).toBe("wczoraj 18:30");
  });
  it("starsze w tym samym roku: bez roku", () => {
    expect(formatNoteDate(new Date(2026, 9, 20, 9, 15).getTime(), now)).toBe("20 paź, 09:15");
  });
  it("inny rok: z rokiem", () => {
    expect(formatNoteDate(new Date(2025, 2, 3, 7, 5).getTime(), now)).toBe("3 mar 2025, 07:05");
  });
  it("granica doby: 23:59 wczoraj nadal „wczoraj”, a 00:01 dziś to „dziś”", () => {
    expect(formatNoteDate(new Date(2026, 10, 4, 23, 59).getTime(), now)).toBe("wczoraj 23:59");
    expect(formatNoteDate(new Date(2026, 10, 5, 0, 1).getTime(), now)).toBe("dziś 00:01");
  });
});
