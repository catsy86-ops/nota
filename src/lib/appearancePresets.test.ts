import { beforeEach, describe, expect, it } from "vitest";
import { applyValues, isPresetActive, PRESETS, readSlot, saveSlot, slotSummary } from "@/lib/appearancePresets";
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

describe("zestawy: włączony i opis slotu (Ustawienia, 2026-11-02)", () => {
  beforeEach(() => localStorage.clear());

  it("isPresetActive — po włączeniu tak, po zmianie jednego klucza nie; kolejność pól obiektu bez znaczenia", () => {
    const read = PRESETS.find((p) => p.id === "read")!;
    expect(isPresetActive(read.values)).toBe(false);
    applyValues(read.values, { full: false });
    expect(isPresetActive(read.values)).toBe(true);
    localStorage.setItem("kaczy.glow.v1", JSON.stringify({ color: "theme", strength: "off" }));
    expect(isPresetActive(read.values)).toBe(true);
    localStorage.setItem("kaczy.textSize.v1", JSON.stringify(3));
    expect(isPresetActive(read.values)).toBe(false);
  });

  it("nowe zestawy mają opis i tylko znane klucze wyglądu", () => {
    for (const p of PRESETS) {
      expect(p.desc.length).toBeGreaterThan(10);
      for (const k of Object.keys(p.values)) expect(k.startsWith("kaczy")).toBe(true);
    }
    expect(PRESETS.map((p) => p.id)).toEqual(["site", "night", "read", "battery"]);
  });

  it("slotSummary — styl, schemat, rozmiar tekstu i ruch", () => {
    expect(slotSummary({ "kaczy.skin.v1": JSON.stringify("zorza"), "kaczy.skinScheme.v1": JSON.stringify({ zorza: "dark" }), "kaczy.textSize.v1": JSON.stringify(3) })).toBe("Zorza, ciemny · tekst 125%");
    expect(slotSummary({ "kaczy-theme": "light", "kaczy.motion.v1": JSON.stringify("reduced") })).toBe("Zeszyt, jasny · bez ruchu");
    expect(slotSummary({})).toBe("Zeszyt");
  });
});
