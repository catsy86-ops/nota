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

describe("skróty „g” do pozostałych widoków (QoL)", () => {
  it("każdy nowy klawisz prowadzi do właściwego widoku", () => {
    expect(viewForChord("i")).toBe("inbox");
    expect(viewForChord("z")).toBe("shifts");
    expect(viewForChord("s")).toBe("study");
    expect(viewForChord("l")).toBe("debts");
    expect(viewForChord("t")).toBe("cwiczenia");
  });
});
