import { describe, expect, it } from "vitest";
import { codeFromScan } from "./qrScan";
import { generateCode } from "./sync/pairCode";

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

describe("skaner QR — kod długi (S2.2)", () => {
  it("przyjmuje kod długi z poprawnymi znakami kontrolnymi, odrzuca z literówką", () => {
    const long = generateCode("long");
    expect(codeFromScan(long)).toBe(long);
    expect(codeFromScan("https://n.example/#pair=" + long + "&v=3")).toBe(long);
    const typo = long.slice(0, 3) + (long[3] === "A" ? "B" : "A") + long.slice(4);
    expect(codeFromScan(typo)).toBeNull();
  });
});
