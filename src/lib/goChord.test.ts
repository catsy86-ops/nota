import { describe, it, expect } from "vitest";
import { viewForChord, GO_CHORDS } from "./goChord";

describe("goChord", () => {
  it("mapuje drugi klawisz na widok", () => {
    expect(viewForChord("k")).toBe("trash");
    expect(viewForChord("N")).toBe("notes");
    expect(viewForChord("a")).toBe("archive");
  });
  it("ignoruje nieznane i wieloznakowe klawisze", () => {
    expect(viewForChord("x")).toBeNull();
    expect(viewForChord("Escape")).toBeNull();
  });
  it("klawisze są unikalne", () => {
    expect(new Set(GO_CHORDS.map((c) => c.key)).size).toBe(GO_CHORDS.length);
  });
});
