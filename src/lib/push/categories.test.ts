import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA } from "@/lib/shifts/model";
import { pushPrefs, setPushCategory } from "./prefs";
import { buildPushSchedule, isPushCategoryOff, PUSH_CATEGORIES, type PushNote } from "./schedule";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();
const WED_NOON = at(14, 12);
const note = (over: Partial<PushNote> = {}): PushNote => ({ id: "n1", title: "Zadzwonić do hurtowni", content: "", reminder: null, ...over });

describe("kategorie push — mapowanie kluczy", () => {
  it("prefiksy kategorii są rozłączne", () => {
    const all = PUSH_CATEGORIES.flatMap((c) => c.prefixes);
    expect(new Set(all).size).toBe(all.length);
  });

  it("termin należy do wyłączonej kategorii po swoim kluczu", () => {
    expect(isPushCategoryOff("n:n1:123", ["notatki"])).toBe(true);
    expect(isPushCategoryOff("rd:2026-10-14", ["raporty"])).toBe(true);
    expect(isPushCategoryOff("rw:2026-10-12", ["raporty"])).toBe(true);
    expect(isPushCategoryOff("rd:2026-10-14", ["notatki"])).toBe(false);
    expect(isPushCategoryOff("n:n1:123", [])).toBe(false);
    expect(isPushCategoryOff("n:n1:123", undefined)).toBe(false);
  });
});

describe("kategorie push — harmonogram", () => {
  it("wyłączona kategoria nie trafia do harmonogramu, włączona zostaje", () => {
    const input = { now: WED_NOON, notes: [note({ reminder: at(14, 15) })], shifts: EMPTY_SHIFT_DATA };
    expect(buildPushSchedule(input)).toHaveLength(1);
    expect(buildPushSchedule({ ...input, off: ["notatki"] })).toHaveLength(0);
    expect(buildPushSchedule({ ...input, off: ["grafik", "serwis"] })).toHaveLength(1);
  });
});

describe("kategorie push — zapis preferencji", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("wyłączenie i ponowne włączenie kategorii", () => {
    setPushCategory("serwis", false);
    expect(pushPrefs.get().off).toContain("serwis");
    setPushCategory("serwis", false);
    expect(pushPrefs.get().off?.filter((x) => x === "serwis")).toHaveLength(1);
    setPushCategory("serwis", true);
    expect(pushPrefs.get().off).not.toContain("serwis");
  });
});
