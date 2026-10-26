import { describe, it, expect } from "vitest";
import { viewLabel, VIEW_LABEL } from "./viewMeta";
import { GO_CHORDS } from "./goChord";

describe("nazwy widoków (Powłoka 1.3, PW-1)", () => {
  it("Grafik i Terminy są jedną nazwą wszędzie", () => {
    expect(viewLabel("shifts")).toBe("Grafik");
    expect(viewLabel("reminders")).toBe("Terminy");
  });

  it("każdy skrót „g” ma nazwę z tej samej tabeli", () => {
    for (const c of GO_CHORDS) expect(VIEW_LABEL[c.view]).toBeTruthy();
  });

  it("nazwy widoków są unikalne", () => {
    const names = Object.values(VIEW_LABEL);
    expect(new Set(names).size).toBe(names.length);
  });
});
