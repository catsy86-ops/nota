import { describe, expect, it } from "vitest";
import { storageBreakdown, storageFill, storageWarning } from "./storagePersistence";

const info = (usageBytes: number | null, quotaBytes: number | null) => ({ persisted: true, usageBytes, quotaBytes });

describe("storageWarning", () => {
  it("brak ostrzeżenia poniżej 80% i bez limitu", () => {
    expect(storageWarning(info(50, 100))).toBeNull();
    expect(storageWarning(info(80, 100))).toBeNull();
    expect(storageWarning(info(null, 100))).toBeNull();
    expect(storageWarning(info(10, null))).toBeNull();
  });
  it("ostrzega powyżej 80%", () => {
    expect(storageWarning(info(90, 100))).toContain("90%");
    expect(storageFill(info(1, 4))).toBe(0.25);
  });
});

describe("storageBreakdown (U3.3)", () => {
  it("odejmuje pliki i pamięć podręczną od całości", () => {
    expect(storageBreakdown(100, 60, 30)).toEqual({ files: 60, app: 30, data: 10 });
  });
  it("bez danych o pamięci podręcznej reszta to całość minus pliki, nigdy poniżej zera", () => {
    expect(storageBreakdown(100, 60)).toEqual({ files: 60, data: 40 });
    expect(storageBreakdown(50, 60, 10)).toEqual({ files: 60, app: 10, data: 0 });
  });
});
