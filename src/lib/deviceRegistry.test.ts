import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { activeOtherDevices, cleanDeviceEntry, DEVICES_MAP, dormantOlderDevices, forgetDevice, getLocalDeviceId, readDevices, recordLocalDevice, resetDeviceIdForTests } from "./deviceRegistry";
import { canWriteSchema } from "./formatSchema";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const self = { version: "2026.11.19", schema: 3 };

describe("deviceRegistry (D4.1)", () => {
  beforeEach(() => { localStorage.clear(); resetDeviceIdForTests(); });

  it("stały identyfikator urządzenia", () => {
    const a = getLocalDeviceId();
    resetDeviceIdForTests();
    expect(getLocalDeviceId()).toBe(a);
    expect(a).toMatch(/^[a-z0-9]{8,32}$/);
  });

  it("zapisuje wpis i nie nadpisuje go częściej niż raz na dobę bez zmian", () => {
    const doc = new Y.Doc();
    expect(recordLocalDevice(doc, "Telefon", NOW, "aaaaaaaa11", self)).toBe(true);
    expect(recordLocalDevice(doc, "Telefon", NOW + 1000, "aaaaaaaa11", self)).toBe(false);
    expect(recordLocalDevice(doc, "Laptop", NOW + 2000, "aaaaaaaa11", self)).toBe(true);
    expect(recordLocalDevice(doc, "Laptop", NOW + 3000, "aaaaaaaa11", { ...self, schema: 4 })).toBe(true);
    expect(recordLocalDevice(doc, "Laptop", NOW + 2 * DAY, "aaaaaaaa11", { ...self, schema: 4 })).toBe(true);
    expect(readDevices(doc, NOW + 2 * DAY)).toEqual([{ id: "aaaaaaaa11", name: "Laptop", schema: 4, version: self.version, at: NOW + 2 * DAY }]);
  });

  it("wpis dochodzi do drugiego dokumentu jak każda zmiana", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    recordLocalDevice(a, "A", NOW, "aaaaaaaa11", { version: "x", schema: 2 });
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(activeOtherDevices(b, NOW, "bbbbbbbb22").map((d) => d.schema)).toEqual([2]);
    expect(canWriteSchema(3, activeOtherDevices(b, NOW, "bbbbbbbb22"))).toBe(false);
    expect(canWriteSchema(3, activeOtherDevices(b, NOW, "aaaaaaaa11"))).toBe(true);
  });

  it("czyści niezaufane wartości", () => {
    expect(cleanDeviceEntry("BAD", { name: "x", at: 1 }, NOW)).toBeUndefined();
    expect(cleanDeviceEntry("aaaaaaaa11", { name: "x" }, NOW)).toBeUndefined();
    expect(cleanDeviceEntry("aaaaaaaa11", { name: "a\u202Eb", schema: 9999, version: 5, at: NOW + 5 * DAY }, NOW))
      .toEqual({ id: "aaaaaaaa11", name: "ab", schema: undefined, version: undefined, at: NOW });
  });

  it("najwyżej 50 najnowszych wpisów", () => {
    const doc = new Y.Doc();
    const map = doc.getMap(DEVICES_MAP);
    for (let i = 0; i < 60; i++) map.set(`dev${String(i).padStart(6, "0")}`, { name: "x", at: NOW - i });
    const list = readDevices(doc, NOW);
    expect(list).toHaveLength(50);
    expect(list[0].at).toBe(NOW);
  });

  it("usuwa wpisy starsze niż 180 dni i niepoprawne; zapomina na żądanie", () => {
    const doc = new Y.Doc();
    const map = doc.getMap(DEVICES_MAP);
    map.set("oldoldold1", { name: "stary", at: NOW - 181 * DAY });
    map.set("junk", { name: "x", at: NOW });
    map.set("keepkeep11", { name: "tablet", schema: 1, at: NOW - 40 * DAY });
    recordLocalDevice(doc, "Telefon", NOW, "aaaaaaaa11", self);
    expect([...map.keys()].sort()).toEqual(["aaaaaaaa11", "keepkeep11"]);
    // Niewidziany > 30 dni nie blokuje, ale trafia na listę ostrzeżeń.
    expect(activeOtherDevices(doc, NOW, "aaaaaaaa11")).toEqual([]);
    expect(dormantOlderDevices(doc, 3, NOW, "aaaaaaaa11").map((d) => d.name)).toEqual(["tablet"]);
    forgetDevice(doc, "keepkeep11");
    expect(map.has("keepkeep11")).toBe(false);
  });
});
