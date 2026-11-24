import { describe, expect, it } from "vitest";
import { recordKey } from "./entryCheck";
import { startDayCandidates } from "./startDay";
import type { SiteInfo } from "./sites";

const site = (id: string, o: Partial<SiteInfo> = {}): SiteInfo =>
  ({ id, name: id, address: "", investor: "", created: 1, stored: true, count: 0, open: 0, first: null, last: null, ...o });
const here = { lat: 52.0, lng: 21.0, acc: 10 };
const day = "2026-10-14";

describe("startDayCandidates", () => {
  it("najbliższa przed resztą, reszta od ostatnio używanej", () => {
    const s = [
      site("stara", { last: 100 }),
      site("blisko", { geo: { lat: 52.0005, lng: 21.0, acc: 5 }, last: 1 }),
      site("nowa", { last: 900 }),
    ];
    expect(startDayCandidates(s, here, day, new Map(), 300).map((c) => c.site.id)).toEqual(["blisko", "nowa", "stara"]);
  });

  it("bez pozycji: tylko ostatnio używane, odległość null", () => {
    const s = [site("a", { last: 5, geo: here }), site("b", { last: 9 })];
    const r = startDayCandidates(s, null, day, new Map(), 300);
    expect(r.map((c) => c.site.id)).toEqual(["b", "a"]);
    expect(r.every((c) => c.distance === null)).toBe(true);
  });

  it("pomija zarchiwizowane i oznacza wejście zapisane dziś", () => {
    const s = [site("a", { archived: 5 }), site("b")];
    const rec = new Map([[recordKey("b", day), { at: 123 }]]);
    const r = startDayCandidates(s, null, day, rec, 300);
    expect(r).toHaveLength(1);
    expect(r[0].entered).toBe(true);
  });

  it("budowa dalej niż próg nie wyprzedza ostatnio używanej", () => {
    const s = [site("daleko", { geo: { lat: 52.1, lng: 21.0, acc: 5 }, last: 1 }), site("nowa", { last: 50 })];
    expect(startDayCandidates(s, here, day, new Map(), 300).map((c) => c.site.id)).toEqual(["nowa", "daleko"]);
  });
});
