import { describe, expect, it } from "vitest";
import { FRAME_MIX, frameMix } from "./frames";

describe("frameMix", () => {
  it("zamienia wybór na procent: im wyżej, tym wyraźniejsza ramka", () => {
    expect(frameMix("soft")).toBe("30%");
    expect(frameMix("normal")).toBe("55%");
    expect(frameMix("strong")).toBe("100%");
    expect(FRAME_MIX.soft).toBeLessThan(FRAME_MIX.normal);
    expect(FRAME_MIX.normal).toBeLessThan(FRAME_MIX.strong);
  });
});
