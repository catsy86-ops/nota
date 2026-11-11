import { beforeEach, describe, expect, it } from "vitest";
import { addMileageEntry, mileageStore, removeMileageEntry } from "./companyPrefs";
import { EMPTY_MILEAGE, MILEAGE_ENTRIES_MAX, cleanMileage, type MileageEntry } from "./mileage";

const entry = (id: string, extra: Partial<MileageEntry> = {}): MileageEntry => ({ id, date: 1_793_000_000_000, siteIds: ["a"], distance: 10, rate: 0.89, ...extra });

beforeEach(() => mileageStore.set(EMPTY_MILEAGE));

describe("kilometrówka w magazynie", () => {
  it("dodaje przejazd i zapamiętuje jego stawkę jako domyślną", () => {
    expect(addMileageEntry(entry("e1", { rate: 1.1 }))).toBe(true);
    expect(mileageStore.get().entries.map((e) => e.id)).toEqual(["e1"]);
    expect(mileageStore.get().rate).toBe(1.1);
  });

  it("usuwa przejazd i zwraca go (do cofnięcia); nieznany id nic nie robi", () => {
    addMileageEntry(entry("e1"));
    addMileageEntry(entry("e2"));
    const gone = removeMileageEntry("e1");
    expect(gone?.id).toBe("e1");
    expect(mileageStore.get().entries.map((e) => e.id)).toEqual(["e2"]);
    expect(removeMileageEntry("nie-ma")).toBeUndefined();
    expect(addMileageEntry(gone!)).toBe(true); // cofnięcie
    expect(mileageStore.get().entries).toHaveLength(2);
  });

  it("odrzuca wpis ponad limit (2001.) i mówi o tym", () => {
    mileageStore.set({ rate: 0.89, entries: Array.from({ length: MILEAGE_ENTRIES_MAX }, (_, i) => entry(`e${i}`)) });
    expect(addMileageEntry(entry("ponad"))).toBe(false);
    expect(mileageStore.get().entries).toHaveLength(MILEAGE_ENTRIES_MAX);
  });
});

describe("cleanMileage: granice", () => {
  it("tnie trasę do 20 budów i zachowuje wyliczony dystans tylko w zakresie", () => {
    const sites = Array.from({ length: 30 }, (_, i) => `s${i}`);
    const out = cleanMileage({ rate: 0.89, entries: [entry("a", { siteIds: sites, calculatedDistance: 12.5 }), entry("b", { calculatedDistance: 99_999 })] });
    expect(out.entries[0]?.siteIds).toHaveLength(20);
    expect(out.entries[0]?.calculatedDistance).toBe(12.5);
    expect(out.entries[1]?.calculatedDistance).toBeUndefined();
  });

  it("bierze najwyżej 2000 wpisów i odrzuca zły dystans oraz stawkę", () => {
    const many = Array.from({ length: MILEAGE_ENTRIES_MAX + 10 }, (_, i) => entry(`e${i}`));
    expect(cleanMileage({ rate: 0.89, entries: many }).entries).toHaveLength(MILEAGE_ENTRIES_MAX);
    expect(cleanMileage({ rate: 0.89, entries: [entry("x", { distance: -1 }), entry("y", { rate: 999 })] }).entries).toEqual([]);
  });
});
