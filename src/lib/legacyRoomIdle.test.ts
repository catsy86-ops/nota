import { describe, expect, it } from "vitest";
import { LEGACY_IDLE_MS, legacyIdleExpired } from "./legacyRoomIdle";

const day = 24 * 60 * 60 * 1000;

describe("zgodność ze starszą wersją: 30 dni ciszy (U-3)", () => {
  it("bez zapisu nic nie wygasa", () => {
    expect(legacyIdleExpired(null, 1e15)).toBe(false);
  });
  it("bez pojawienia się liczy się od włączenia; po 30 dniach wygasa", () => {
    const s = { since: 1_000_000, seenAt: null };
    expect(legacyIdleExpired(s, 1_000_000 + LEGACY_IDLE_MS - 1)).toBe(false);
    expect(legacyIdleExpired(s, 1_000_000 + LEGACY_IDLE_MS)).toBe(true);
  });
  it("ostatnie pojawienie się przesuwa termin", () => {
    const s = { since: 0, seenAt: 40 * day };
    expect(legacyIdleExpired(s, 60 * day)).toBe(false);
    expect(legacyIdleExpired(s, 70 * day)).toBe(true);
  });
});
