import { describe, expect, it } from "vitest";
import { cleanDump } from "./studyDump";

// D7 (audyt 2026-11-11): klucz „__proto__” z kopii nie może ustawić prototypu wyniku ani zniknąć po cichu z dziedziczonymi polami.
describe("cleanDump: klucz __proto__", () => {
  it("rounds i review pomijają __proto__, zwykłe klucze zostają", () => {
    const raw = JSON.parse('{"rounds":{"__proto__":{"rounds":5,"best":90},"dev1":{"rounds":2,"best":80}},"review":{"__proto__":{"due":1},"q1":{}}}');
    const d = cleanDump(raw);
    expect(Object.keys(d.rounds)).toEqual(["dev1"]);
    expect(Object.getPrototypeOf(d.rounds)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(d.review)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(d.review, "__proto__")).toBe(false);
  });
});
