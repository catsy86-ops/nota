import { beforeEach, describe, expect, it } from "vitest";
import {
  V2_COMPAT_MS, V2_MAX_MS, V2_ONLY_RECENT_MS, clearV2Only, extendV2Window, getV2Only, latestV2Only, mergeV2Only, recordV2Only,
  v2OnlyNotices, v2WindowStart,
} from "@/lib/sync/v2Window";

const DAY = 24 * 60 * 60 * 1000;

describe("okno v2 — przedłużenie i twardy koniec (S2.6)", () => {
  const start = 100 * DAY;
  const w = { v2Until: start + V2_COMPAT_MS, v2Start: start };

  it("w trakcie okna nic się nie zmienia", () => {
    expect(extendV2Window(w, w.v2Until - 1, w.v2Until - 1)).toBeNull();
  });

  it("bez starego urządzenia w 14 dniach okno się kończy", () => {
    expect(extendV2Window(w, null, w.v2Until)).toBeNull();
    expect(extendV2Window(w, w.v2Until - V2_ONLY_RECENT_MS - 1, w.v2Until)).toBeNull();
  });

  it("przedłuża raz i drugi raz o 30 dni, trzeci raz tylko do 90 dni od początku", () => {
    const once = extendV2Window(w, w.v2Until - DAY, w.v2Until);
    expect(once).toEqual({ v2Until: start + 2 * V2_COMPAT_MS, v2Start: start });
    const twice = extendV2Window(once!, once!.v2Until - DAY, once!.v2Until);
    expect(twice).toEqual({ v2Until: start + 3 * V2_COMPAT_MS, v2Start: start });
    expect(twice!.v2Until).toBe(start + V2_MAX_MS);
    // Twardy koniec: mimo urządzenia nic już nie przedłuża.
    expect(extendV2Window(twice!, twice!.v2Until - DAY, twice!.v2Until)).toBeNull();
  });

  it("zapis sprzed przedłużeń dostaje początek z `v2Until − 30 dni`", () => {
    const old = { v2Until: start + V2_COMPAT_MS };
    expect(v2WindowStart(old)).toBe(start);
    const ext = extendV2Window(old, old.v2Until - DAY, old.v2Until + 5 * DAY);
    expect(ext).toEqual({ v2Until: start + 2 * V2_COMPAT_MS, v2Start: start });
  });

  it("przedłużenie, które i tak byłoby w przeszłości, kończy okno", () => {
    expect(extendV2Window(w, w.v2Until + 40 * DAY, w.v2Until + 40 * DAY)).toBeNull();
  });
});

describe("urządzenia widziane tylko w v2", () => {
  beforeEach(() => {
    localStorage.clear();
    for (const name of Object.keys(getV2Only())) clearV2Only(name);
  });

  it("scala nazwy, czyści znaki sterujące, trzyma najwyżej 20", () => {
    let m = mergeV2Only({}, ["Tablet", "Tablet‮", ""], 10);
    expect(m).toEqual({ Tablet: 10 });
    for (let i = 0; i < 25; i++) m = mergeV2Only(m, [`U${i}`], 100 + i);
    expect(Object.keys(m)).toHaveLength(20);
    expect(m.Tablet).toBeUndefined();
    expect(m.U24).toBe(124);
  });

  it("latestV2Only widzi tylko ostatnie 14 dni", () => {
    const now = 100 * DAY;
    expect(latestV2Only({ A: now - 20 * DAY }, now)).toBeNull();
    expect(latestV2Only({ A: now - 20 * DAY, B: now - 3 * DAY, C: now - 5 * DAY }, now)).toBe(now - 3 * DAY);
  });

  it("komunikaty: w oknie tylko świeże wpisy, po oknie wszystkie; zamknięcie usuwa wpis", () => {
    const now = 100 * DAY;
    recordV2Only(["Tablet"], now - 20 * DAY);
    recordV2Only(["Telefon"], now - DAY);
    expect(v2OnlyNotices(getV2Only(), true, now).map((n) => n.name)).toEqual(["Telefon"]);
    expect(v2OnlyNotices(getV2Only(), false, now).map((n) => n.name)).toEqual(["Telefon", "Tablet"]);
    clearV2Only("Telefon");
    expect(Object.keys(getV2Only())).toEqual(["Tablet"]);
  });
});
