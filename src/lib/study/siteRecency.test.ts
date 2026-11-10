import { describe, expect, it } from "vitest";
import { activeSitesByRecency } from "./siteRecency";
import type { SiteInfo } from "./sites";

const site = (id: string, name: string, created: number, archived?: number): SiteInfo =>
  ({ id, name, address: "", investor: "", created, archived, stored: true, count: 0, open: 0, first: 0, last: 0 });

describe("budowy na ekranie Budowa", () => {
  const dir = [site("a", "Lipowa", 100), site("b", "Polna", 200), site("c", "Stara", 50, 10)];

  it("pomija archiwalne i układa od ostatniego wpisu", () => {
    const out = activeSitesByRecency(dir, [{ siteId: "a", site: "Lipowa", at: 500 }, { site: "Polna", at: 300 }]);
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("wpis sprzed kart rozpoznaje po nazwie, a budowa bez wpisów idzie po dacie założenia", () => {
    expect(activeSitesByRecency(dir, [{ site: "Lipowa", at: 900 }]).map((s) => s.id)).toEqual(["a", "b"]);
    expect(activeSitesByRecency(dir, []).map((s) => s.id)).toEqual(["b", "a"]);
  });
});
