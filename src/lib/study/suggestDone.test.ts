import { describe, expect, it } from "vitest";
import { SUGGEST_DONE_MIN_SEEN, suggestsDone } from "./stats";

// Podpowiedź „Umiem” (Etap 4 § 4.1) dopiero przy wysokiej trafności i wystarczającej liczbie odpowiedzi.
describe("suggestsDone", () => {
  it("podpowiada przy trafności ≥90% i co najmniej 10 odpowiedziach", () => {
    expect(suggestsDone({ percent: 95, seen: SUGGEST_DONE_MIN_SEEN })).toBe(true);
  });
  it("nie podpowiada przy za małej próbie albo słabej trafności", () => {
    expect(suggestsDone({ percent: 100, seen: SUGGEST_DONE_MIN_SEEN - 1 })).toBe(false);
    expect(suggestsDone({ percent: 80, seen: 50 })).toBe(false);
    expect(suggestsDone({ percent: null, seen: 0 })).toBe(false);
  });
});
