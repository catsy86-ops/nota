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
