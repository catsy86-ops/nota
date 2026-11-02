import { describe, expect, it } from "vitest";
import { groupPhotos, PHOTO_GAP_MS, type GroupContext, type PhotoInfo } from "./photoImport";

const T0 = new Date(2026, 9, 14, 7, 40).getTime();
const LIPOWA = { lat: 50.06, lng: 19.93, acc: 10 };
const POLNA = { lat: 50.1, lng: 20.0, acc: 10 };

const ctx = (over: Partial<GroupContext> = {}): GroupContext => ({
  sites: [{ id: "lipowa", name: "Lipowa 5", geo: LIPOWA }, { id: "polna", name: "Polna 2", geo: POLNA }, { id: "stara", name: "Stara 1" }],
  daySites: () => [],
  current: null,
  dayKeyOf: (at) => new Date(at).toDateString(),
  ...over,
});
const photo = (key: number, at: number, geo?: PhotoInfo["geo"]): PhotoInfo => ({ key, at, exact: true, ...(geo ? { geo } : {}) });

describe("groupPhotos", () => {
  it("przerwa ponad godzinę dzieli wpisy; kolejność wg czasu", () => {
    const g = groupPhotos([photo(2, T0 + 30 * 60_000), photo(1, T0), photo(3, T0 + 30 * 60_000 + PHOTO_GAP_MS + 1)], ctx());
    expect(g.map((x) => x.keys)).toEqual([[1, 2], [3]]);
    expect(g[0]).toMatchObject({ start: T0, end: T0 + 30 * 60_000 });
  });

  it("budowa z GPS; inna budowa z GPS zaczyna nowy wpis", () => {
    const g = groupPhotos([photo(1, T0, LIPOWA), photo(2, T0 + 60_000), photo(3, T0 + 2 * 60_000, POLNA)], ctx());
    expect(g.map((x) => [x.keys, x.site, x.why])).toEqual([[[1, 2], "Lipowa 5", "gps"], [[3], "Polna 2", "gps"]]);
  });

  it("bez GPS: jedyna budowa dnia, potem bieżąca, potem żadna", () => {
    expect(groupPhotos([photo(1, T0)], ctx({ daySites: () => ["stara"] }))[0]).toMatchObject({ site: "Stara 1", why: "day" });
    expect(groupPhotos([photo(1, T0)], ctx({ daySites: () => ["stara", "polna"], current: "polna" }))[0]).toMatchObject({ site: "Polna 2", why: "day" });
    expect(groupPhotos([photo(1, T0)], ctx({ daySites: () => ["stara", "polna"], current: "lipowa" }))[0]).toMatchObject({ site: "Lipowa 5", why: "current" });
    expect(groupPhotos([photo(1, T0)], ctx())[0]).toMatchObject({ site: "", why: "none" });
  });

  it("inny dzień i pełny wpis dzielą grupę", () => {
    const midnight = new Date(2026, 9, 14, 23, 50).getTime();
    expect(groupPhotos([photo(1, midnight), photo(2, midnight + 20 * 60_000)], ctx())).toHaveLength(2);
    const many = Array.from({ length: 7 }, (_, i) => photo(i, T0 + i * 60_000));
    expect(groupPhotos(many, ctx(), 5).map((x) => x.keys.length)).toEqual([5, 2]);
  });

  it("zdjęcie z GPS daleko od budów nie przypisuje budowy", () => {
    const g = groupPhotos([photo(1, T0, { lat: 0.5, lng: 0.5, acc: 10 })], ctx());
    expect(g[0].why).toBe("none");
  });
});

