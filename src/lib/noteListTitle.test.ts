import { describe, expect, it } from "vitest";
import { noteListTitle } from "./noteListTitle";

const NL = String.fromCharCode(10);

describe("noteListTitle (Dziś 1.2)", () => {
  it("prywatna — „Notatka prywatna”; tytuł; pierwsza linia; „Bez tytułu”", () => {
    expect(noteListTitle({ title: "", content: "", locked: true })).toBe("Notatka prywatna");
    expect(noteListTitle({ title: " Rury ", content: "x" })).toBe("Rury");
    expect(noteListTitle({ title: "", content: `${NL} Zadzwonić ${NL}jutro` })).toBe("Zadzwonić");
    expect(noteListTitle({ title: "", content: " " })).toBe("Bez tytułu");
  });
});
