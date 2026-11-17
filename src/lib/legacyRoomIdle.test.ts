import { describe, expect, it } from "vitest";
import { LEGACY_IDLE_MS, legacyEndsAt, legacyIdleExpired } from "./legacyRoomIdle";

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

describe("zgodność ze starszą wersją: twardy koniec 90 dni (S2.6)", () => {
  it("cisza: koniec 30 dni od włączenia", () => {
    expect(legacyEndsAt({ since: 0, seenAt: null })).toBe(30 * day);
  });
  it("aktywne stare urządzenie: najpóźniej 90 dni od włączenia", () => {
    const s = { since: 0, seenAt: 85 * day };
    expect(legacyEndsAt(s)).toBe(90 * day);
    expect(legacyIdleExpired(s, 90 * day - 1)).toBe(false);
    expect(legacyIdleExpired(s, 90 * day)).toBe(true);
  });
});
