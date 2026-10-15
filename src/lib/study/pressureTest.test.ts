import { describe, expect, it } from "vitest";
import { cleanTest, defaultTest, testLine } from "./pressureTest";

describe("protokół próby szczelności", () => {
  it("domyślny protokół zależy od tematu", () => {
    expect(defaultTest("proba-kan")).toMatchObject({ medium: "sewer", bar: null, ok: true });
    expect(defaultTest("proba-wody")).toMatchObject({ medium: "air", bar: 6 });
  });

  it("cleanTest odrzuca śmieci, przy kanalizacji gubi ciśnienie i spadek", () => {
    expect(cleanTest(null)).toBeNull();
    expect(cleanTest({ medium: "gaz", ok: true })).toBeNull();
    expect(cleanTest({ medium: "water", bar: 9 })).toBeNull();
    expect(cleanTest({ medium: "water", bar: 9.004, minutes: 30, drop: -1, ok: true })).toEqual({ medium: "water", bar: 9, minutes: 30, drop: null, ok: true });
    expect(cleanTest({ medium: "sewer", bar: 9, drop: 1, minutes: 15, ok: false })).toEqual({ medium: "sewer", bar: null, minutes: 15, drop: null, ok: false });
  });

  it("testLine: czytelny opis z polskim przecinkiem dziesiętnym", () => {
    expect(testLine({ medium: "air", bar: 6, minutes: 30, drop: 0.1, ok: true })).toBe("Próba szczelności (powietrze, 6 bar, 30 min, spadek 0,1 bar): szczelna");
    expect(testLine({ medium: "sewer", bar: null, minutes: null, drop: null, ok: false })).toBe("Próba na zalanie (kanalizacja): nieszczelna");
  });
});
