import { describe, expect, it } from "vitest";
import { shiftTime } from "./TimeStepper";

describe("shiftTime", () => {
  it("przesuwa o kwanty i zawija przez północ", () => {
    expect(shiftTime("06:00", 15)).toBe("06:15");
    expect(shiftTime("06:00", -15)).toBe("05:45");
    expect(shiftTime("23:50", 15)).toBe("00:05");
    expect(shiftTime("00:05", -15)).toBe("23:50");
  });
});
