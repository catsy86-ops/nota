import { describe, expect, it } from "vitest";
import { SHRINK_MAX_SIDE, shrinkDimensions } from "./photoShrink";

describe("zmniejszanie zdjęć budowy (P-4)", () => {
  it("zdjęcie mieszczące się w 800 px nie jest zmniejszane", () => {
    expect(shrinkDimensions(800, 600)).toBeNull();
    expect(shrinkDimensions(640, 480)).toBeNull();
  });
  it("dłuższy bok schodzi do 800 px, proporcje zostają", () => {
    expect(shrinkDimensions(4000, 3000)).toEqual({ width: 800, height: 600 });
    expect(shrinkDimensions(3000, 4000)).toEqual({ width: 600, height: 800 });
    expect(SHRINK_MAX_SIDE).toBe(800);
  });
});
