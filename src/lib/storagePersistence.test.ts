import { describe, expect, it } from "vitest";
import { storageFill, storageWarning } from "./storagePersistence";

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
