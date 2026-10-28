import { describe, expect, it } from "vitest";
import { arrivalSite } from "./siteArrival";
import { recordKey } from "./entryCheck";
import type { SiteCard } from "./sites";

const site = (id: string, lat: number, lng: number, extra: Partial<SiteCard> = {}) =>
  ({ id, name: id, address: "", investor: "", geo: { lat, lng, acc: 10 }, ...extra }) as SiteCard;

// ~0,0009° szerokości to ok. 100 m.
const HERE = { lat: 52.2297, lng: 21.0122, acc: 15 };
const DAY = "2026-10-28";

describe("arrivalSite (P2.10)", () => {
  it("wybiera budowę w promieniu", () => {
    expect(arrivalSite([site("a", 52.2298, 21.0122)], HERE, DAY, new Map())?.id).toBe("a");
  });

  it("nic, gdy żadna budowa nie jest blisko", () => {
    expect(arrivalSite([site("far", 52.3, 21.2)], HERE, DAY, new Map())).toBeNull();
  });

  it("pomija budowę, na którą jest już wejście tego dnia", () => {
    const records = new Map([[recordKey("a", DAY), { at: 1 }]]);
    expect(arrivalSite([site("a", 52.2298, 21.0122)], HERE, DAY, records)).toBeNull();
  });

  it("wejście z innego dnia nie blokuje", () => {
    const records = new Map([[recordKey("a", "2026-10-27"), { at: 1 }]]);
    expect(arrivalSite([site("a", 52.2298, 21.0122)], HERE, DAY, records)?.id).toBe("a");
  });

  it("budowy bez lokalizacji i zarchiwizowane są pomijane", () => {
    const noGeo = { id: "x", name: "x", address: "", investor: "" } as SiteCard;
    expect(arrivalSite([noGeo, site("old", 52.2298, 21.0122, { archived: 1 })], HERE, DAY, new Map())).toBeNull();
  });
});
