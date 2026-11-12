import { beforeEach, describe, expect, it } from "vitest";
import { REST_DEFAULT, REST_KEY, restLabel, restStore, setRestSeconds } from "./restPrefs";

describe("restPrefs", () => {
  beforeEach(() => localStorage.clear());

  it("domyślnie 90 s; zapisany wybór z listy zostaje, obca wartość jest ignorowana", () => {
    expect(restStore.get()).toBe(REST_DEFAULT);
    setRestSeconds(120);
    expect(restStore.get()).toBe(120);
    expect(JSON.parse(localStorage.getItem(REST_KEY) ?? "null")).toBe(120);
  });

  it("etykiety: minuty dla pełnych, sekundy dla reszty", () => {
    expect([60, 90, 120, 180].map(restLabel)).toEqual(["1 min", "90 s", "2 min", "3 min"]);
  });
});
