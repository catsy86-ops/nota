import { describe, expect, it } from "vitest";
import { relayErrorHint } from "@/lib/sync/relayErrorHint";

describe("relayErrorHint", () => {
  it("ROOM_FULL daje wskazówkę z przejściem do zmiany kodu", () => {
    const h = relayErrorHint("ROOM_FULL");
    expect(h?.text).toMatch(/miejsce na przekaźniku/i);
    expect(h?.text).toMatch(/zapisane tutaj/);
    expect(h?.action?.target).toBe("code-change");
  });
  it("bez kodu nie ma wskazówki — UI pokazuje detail", () => {
    expect(relayErrorHint(undefined)).toBeNull();
  });
});
