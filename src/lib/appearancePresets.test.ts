import { beforeEach, describe, expect, it } from "vitest";
import { applyValues, PRESETS, readSlot, saveSlot } from "@/lib/appearancePresets";
import { setShape } from "@/lib/shape";

describe("zestawy wyglądu (plan motywów 2026-10-30, 1.3)", () => {
  beforeEach(() => localStorage.clear());

  it("gotowy zestaw zmienia tylko swoje klucze; „Cofnij” (wartości sprzed) wraca dokładnie", () => {
    setShape("soft");
    const site = PRESETS.find((p) => p.id === "site")!;
    const before = applyValues(site.values, { full: false });
    expect(localStorage.getItem("kaczy.skin.v1")).toBe(JSON.stringify("odblask"));
    expect(localStorage.getItem("kaczy.shape.v1")).toBe(JSON.stringify("soft"));
    expect(before).toEqual({ "kaczy.shape.v1": JSON.stringify("soft") });
    applyValues(before, { full: true });
    expect(localStorage.getItem("kaczy.skin.v1")).toBeNull();
    expect(localStorage.getItem("kaczy.shape.v1")).toBe(JSON.stringify("soft"));
  });

  it("własny slot zapisuje cały wygląd i wraca w całości", () => {
    setShape("sharp");
    saveSlot(2);
    expect(readSlot(1)).toBeNull();
    expect(readSlot(2)).toEqual({ "kaczy.shape.v1": JSON.stringify("sharp") });
    setShape("soft");
    applyValues(readSlot(2)!, { full: true });
    expect(localStorage.getItem("kaczy.shape.v1")).toBe(JSON.stringify("sharp"));
  });

  it("uszkodzony slot jest traktowany jak pusty", () => {
    localStorage.setItem("kaczy.appearance.slot.1.v1", "{zepsute");
    expect(readSlot(1)).toBeNull();
    localStorage.setItem("kaczy.appearance.slot.1.v1", JSON.stringify([1, 2]));
    expect(readSlot(1)).toBeNull();
  });
});
