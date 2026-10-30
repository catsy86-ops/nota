import { describe, expect, it } from "vitest";
import { cityById, isNightAt, sunTimes } from "@/lib/sun";

const hm = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

describe("wschód i zachód słońca (plan motywów 3.2)", () => {
  const warsaw = cityById("warszawa");

  it("Londyn, przesilenie letnie: wschód 03:43, zachód 20:21 UTC (±3 min, wzór sprawdzony na danych)", () => {
    const t = sunTimes(51.5074, -0.1278, new Date(2026, 5, 21, 12))!;
    expect(Math.abs(hm(t.rise) - (3 * 60 + 43))).toBeLessThanOrEqual(3);
    expect(Math.abs(hm(t.set) - (20 * 60 + 21))).toBeLessThanOrEqual(3);
  });

  it("Warszawa, przesilenie letnie: wschód ~02:13, zachód ~19:00 UTC (wynik wzoru, ±5 min)", () => {
    const t = sunTimes(warsaw.lat, warsaw.lon, new Date(2026, 5, 21, 12))!;
    expect(Math.abs(hm(t.rise) - (2 * 60 + 13))).toBeLessThanOrEqual(5);
    expect(Math.abs(hm(t.set) - (19 * 60 + 0))).toBeLessThanOrEqual(5);
  });

  it("równonoc: dzień ~12 godzin (±20 min)", () => {
    const t = sunTimes(warsaw.lat, warsaw.lon, new Date(2026, 2, 20, 12))!;
    const dayMin = (t.set.getTime() - t.rise.getTime()) / 60000;
    expect(Math.abs(dayMin - 12 * 60)).toBeLessThanOrEqual(20);
  });

  it("północ w dzień polarny nie ma wschodu: dla Warszawy zawsze jest", () => {
    expect(sunTimes(warsaw.lat, warsaw.lon, new Date(2026, 5, 21, 12))).not.toBeNull();
  });

  it("noc to po zachodzie i przed wschodem tego samego dnia", () => {
    expect(isNightAt(new Date(2026, 5, 21, 23), warsaw)).toBe(true);
    expect(isNightAt(new Date(2026, 5, 21, 12), warsaw)).toBe(false);
  });
});
