import { describe, it, expect } from "vitest";
import { hashImage } from "./imageHash";

describe("hashImage", () => {
  it("is deterministic for identical content", () => {
    const a = "data:image/png;base64,AAAABBBBCCCC";
    expect(hashImage(a)).toBe(hashImage(a));
  });

  it("differs for different content", () => {
    expect(hashImage("data:image/png;base64,AAAA")).not.toBe(hashImage("data:image/png;base64,BBBB"));
  });

  it("differs when only length differs (guards the sampling step)", () => {
    const short = "data:image/png;base64," + "A".repeat(10);
    const long = "data:image/png;base64," + "A".repeat(10000);
    expect(hashImage(short)).not.toBe(hashImage(long));
  });

  it("handles empty string without throwing", () => {
    expect(() => hashImage("")).not.toThrow();
  });
});
