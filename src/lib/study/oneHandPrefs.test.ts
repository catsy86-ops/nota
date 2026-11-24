import { describe, expect, it } from "vitest";
import { ONE_HAND_OFFER_AFTER, shouldOfferOneHand } from "./oneHandPrefs";

const usage = (n: number) => ({ wpis: { n, last: 0 } });
const base = { usage: usage(ONE_HAND_OFFER_AFTER), enabled: false, offered: false, touch: true };

describe("shouldOfferOneHand", () => {
  it("proponuje po progu wpisów na dotykowym urządzeniu", () => {
    expect(shouldOfferOneHand(base)).toBe(true);
  });
  it("nie proponuje przed progiem ani bez licznika", () => {
    expect(shouldOfferOneHand({ ...base, usage: usage(ONE_HAND_OFFER_AFTER - 1) })).toBe(false);
    expect(shouldOfferOneHand({ ...base, usage: {} })).toBe(false);
  });
  it("nie proponuje, gdy tryb włączony, już pytano albo brak dotyku", () => {
    expect(shouldOfferOneHand({ ...base, enabled: true })).toBe(false);
    expect(shouldOfferOneHand({ ...base, offered: true })).toBe(false);
    expect(shouldOfferOneHand({ ...base, touch: false })).toBe(false);
  });
});
