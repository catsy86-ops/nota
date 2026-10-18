import { describe, expect, it } from "vitest";
import { accuracyLabel, cleanGeo, distanceM, mapsUrl, nearestSite } from "./geo";

const lipowa = { lat: 52.22977, lng: 21.01178, acc: 10 };

describe("cleanGeo", () => {
  it("przepuszcza poprawny punkt, zaokrągla współrzędne i dokładność", () => {
    expect(cleanGeo({ lat: 52.2297712345, lng: 21.0117812345, acc: 12.6 })).toEqual({ lat: 52.22977, lng: 21.01178, acc: 13 });
  });

  it("odrzuca śmieci i wartości spoza zakresu", () => {
    expect(cleanGeo(null)).toBeUndefined();
    expect(cleanGeo({ lat: 91, lng: 0, acc: 1 })).toBeUndefined();
    expect(cleanGeo({ lat: 0, lng: 181, acc: 1 })).toBeUndefined();
    expect(cleanGeo({ lat: 0, lng: 0, acc: -1 })).toBeUndefined();
    expect(cleanGeo({ lat: "52", lng: 21, acc: 1 })).toBeUndefined();
    expect(cleanGeo({ lat: NaN, lng: 21, acc: 1 })).toBeUndefined();
  });
});

describe("distanceM i nearestSite", () => {
  it("liczy odległość w metrach", () => {
    expect(distanceM(lipowa, lipowa)).toBe(0);
    // ~111 m na 0,001° szerokości.
    expect(distanceM(lipowa, { ...lipowa, lat: lipowa.lat + 0.001 })).toBeGreaterThan(100);
    expect(distanceM(lipowa, { ...lipowa, lat: lipowa.lat + 0.001 })).toBeLessThan(120);
  });

  it("wybiera najbliższą budowę w promieniu, pomija archiwum i budowy bez lokalizacji", () => {
    const sites = [
      { id: "daleko", geo: { lat: 52.3, lng: 21.0, acc: 10 } },
      { id: "obok", geo: { lat: 52.2299, lng: 21.0118, acc: 10 } },
      { id: "archiwum", geo: lipowa, archived: 1 },
      { id: "bez" },
    ];
    expect(nearestSite(sites, lipowa)?.id).toBe("obok");
    expect(nearestSite([sites[0], sites[3]], lipowa)).toBeNull();
  });
});

describe("mapsUrl i accuracyLabel", () => {
  it("daje link do map i czytelną dokładność", () => {
    expect(mapsUrl(lipowa)).toBe("https://www.google.com/maps/search/?api=1&query=52.22977,21.01178");
    expect(accuracyLabel(lipowa)).toBe("±10 m");
    expect(accuracyLabel({ ...lipowa, acc: 1500 })).toBe("±1,5 km");
  });
});
