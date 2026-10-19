import { describe, expect, it } from "vitest";
import { readPushSummary } from "./summary";

describe("readPushSummary", () => {
  it("czyta poprawne podsumowanie", () => {
    const raw = JSON.stringify({ sent: 200, total: 214, dropped: 14, limit: 200, at: 1 });
    expect(readPushSummary(raw)).toEqual({ sent: 200, total: 214, dropped: 14, limit: 200, at: 1 });
  });

  it("brak klucza, śmieci i niepełne pola → null", () => {
    expect(readPushSummary(null)).toBeNull();
    expect(readPushSummary("{nie-json")).toBeNull();
    expect(readPushSummary(JSON.stringify({ sent: 1 }))).toBeNull();
  });
});
