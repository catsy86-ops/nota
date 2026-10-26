import { describe, expect, it } from "vitest";
import { canWriteSchema, olderDevices, SCHEMA_VERSION } from "./formatSchema";

describe("numer formatu i urządzenia (Ustawienia 2.1)", () => {
  it("nowy format zapisuje się tylko, gdy wszystkie widziane urządzenia go znają", () => {
    expect(canWriteSchema(2, [{ schema: 2 }, { schema: 3 }])).toBe(true);
    expect(canWriteSchema(2, [{ schema: 2 }, { schema: 1 }])).toBe(false);
    // Urządzenie sprzed tej zmiany (bez numeru) blokuje każdy nowy format.
    expect(canWriteSchema(1, [{}])).toBe(false);
    expect(canWriteSchema(1, [])).toBe(true);
  });

  it("baner: urządzenia z niższym numerem niż ten w aplikacji", () => {
    const devs = [{ name: "A", schema: SCHEMA_VERSION }, { name: "B", schema: 0 }, { name: "C" }];
    expect(olderDevices(devs).map((d) => d.name)).toEqual(["B", "C"]);
  });
});

describe("bramka zapisu v2 (V-3)", () => {
  it("bez urządzeń wolno; z urządzeniem sprzed schematu 2 nie", async () => {
    const { setDeviceSource, writeFormatAllowed } = await import("./formatSchema");
    setDeviceSource(() => []);
    expect(writeFormatAllowed(2)).toBe(true);
    setDeviceSource(() => [{ schema: 1 }]);
    expect(writeFormatAllowed(2)).toBe(false);
    setDeviceSource(() => [{ schema: 2 }, { schema: 2 }]);
    expect(writeFormatAllowed(2)).toBe(true);
    setDeviceSource(() => []);
  });
});

describe("przegląd V-3, punkt 2: deklaracje wersji z awareness", () => {
  it("przyjmuje tylko całkowite, rozsądne numery i krótkie wersje", async () => {
    const { cleanSchemaClaim, cleanVersionClaim, MAX_SCHEMA_CLAIM } = await import("./formatSchema");
    expect(cleanSchemaClaim(2)).toBe(2);
    expect(cleanSchemaClaim(2.5)).toBeUndefined();
    expect(cleanSchemaClaim(-1)).toBeUndefined();
    expect(cleanSchemaClaim(MAX_SCHEMA_CLAIM + 1)).toBeUndefined();
    expect(cleanSchemaClaim("2")).toBeUndefined();
    expect(cleanVersionClaim("2026.10.26")).toBe("2026.10.26");
    expect(cleanVersionClaim("x".repeat(40))).toBeUndefined();
    expect(cleanVersionClaim({})).toBeUndefined();
  });
});
