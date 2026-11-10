import { beforeEach, describe, expect, it } from "vitest";
import { readUsage, trackUse, USAGE_KEY, usageReportLines, usageRows } from "./usage";

beforeEach(() => localStorage.clear());

describe("licznik użycia Pracy", () => {
  it("zlicza użycia i zapamiętuje ostatnie", () => {
    trackUse("kalkulatory", 1000);
    trackUse("kalkulatory", 2000);
    trackUse("zestawy", 3000);
    expect(readUsage()).toEqual({ kalkulatory: { n: 2, last: 2000 }, zestawy: { n: 1, last: 3000 } });
  });

  it("odrzuca nazwy spoza wzorca (nie zapisuje treści)", () => {
    trackUse("Wpis: Lipowa 7, kod bramy 1234");
    trackUse("");
    expect(readUsage()).toEqual({});
  });

  it("uszkodzony zapis i dziwne kształty dają pusty wynik", () => {
    for (const bad of ["{", "[]", "null", '{"a":1}', '{"a":{"n":"x","last":1}}', '{"a":{"n":-1,"last":1}}']) {
      localStorage.setItem(USAGE_KEY, bad);
      expect(readUsage()).toEqual({});
    }
  });

  it("trzyma najwyżej 60 funkcji i wyrzuca najstarsze", () => {
    for (let i = 0; i < 65; i++) trackUse(`f${i}`, i + 1);
    const map = readUsage();
    expect(Object.keys(map)).toHaveLength(60);
    expect(map.f0).toBeUndefined();
    expect(map.f64).toBeDefined();
  });

  it("wiersze: od najczęstszych, nieużywane od 30 dni oznaczone", () => {
    const now = Date.UTC(2026, 10, 10);
    const rows = usageRows({ a: { n: 1, last: now - 40 * 86_400_000 }, b: { n: 5, last: now } }, now);
    expect(rows.map((r) => [r.feature, r.idle])).toEqual([["b", false], ["a", true]]);
  });

  it("raport: „brak” bez danych", () => {
    expect(usageReportLines({})).toEqual(["brak"]);
    expect(usageReportLines({ a: { n: 2, last: Date.UTC(2026, 10, 9) } }, Date.UTC(2026, 10, 10))[0]).toBe("a: 2x, ostatnio 2026-11-09");
  });

  it("nie rzuca, gdy localStorage jest niedostępny", () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error("quota"); };
    try { expect(() => trackUse("x")).not.toThrow(); } finally { Storage.prototype.setItem = orig; }
  });
});
