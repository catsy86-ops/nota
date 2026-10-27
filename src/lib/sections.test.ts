import { describe, expect, it } from "vitest";
import { sectionIconClass } from "./sections";

describe("odcień działu (D-4)", () => {
  it("cztery działy z własnym kolorem ikony", () => {
    expect(sectionIconClass("notes")).toBe("sec-notes");
    expect(sectionIconClass("shifts")).toBe("sec-shifts");
    expect(sectionIconClass("study")).toBe("sec-study");
    expect(sectionIconClass("calendar")).toBe("sec-calendar");
  });

  it("pozostałe widoki nie dostają klasy", () => {
    expect(sectionIconClass("today")).toBeUndefined();
    expect(sectionIconClass("trash")).toBeUndefined();
  });
});
