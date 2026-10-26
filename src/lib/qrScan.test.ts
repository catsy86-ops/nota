import { describe, expect, it } from "vitest";
import { codeFromScan } from "./qrScan";

describe("skaner QR (U-2)", () => {
  it("przyjmuje sam kod i cały link ?pair=", () => {
    expect(codeFromScan("ABCD2345EFGH")).toBe("ABCD2345EFGH");
    expect(codeFromScan("https://example.test/?pair=ABCD2345EFGH")).toBe("ABCD2345EFGH");
  });
  it("odrzuca tekst, który nie jest kodem grupy", () => {
    expect(codeFromScan("to nie jest kod")).toBeNull();
    expect(codeFromScan("https://example.test/")).toBeNull();
  });
});
