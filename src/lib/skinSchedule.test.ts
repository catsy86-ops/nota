import { beforeEach, describe, expect, it } from "vitest";
import { isNight, isNightHours, scheduledSkin, setSkinSchedule, skinScheduleStore, type SkinSchedule } from "@/lib/skinSchedule";
import { setSkin, skinStore } from "@/lib/skins";

const base: SkinSchedule = { enabled: true, day: "zeszyt", night: "zorza", mode: "hours", city: "warszawa", from: "20:00", to: "07:00" };
const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m);

describe("styl na noc — decyzja", () => {
  it("godziny przez północ: 20:00–07:00", () => {
    expect(isNightHours(at(21), "20:00", "07:00")).toBe(true);
    expect(isNightHours(at(3), "20:00", "07:00")).toBe(true);
    expect(isNightHours(at(7), "20:00", "07:00")).toBe(false);
    expect(isNightHours(at(12), "20:00", "07:00")).toBe(false);
  });
  it("godziny w ciągu doby i równe granice", () => {
    expect(isNightHours(at(14), "13:00", "15:00")).toBe(true);
    expect(isNightHours(at(9), "09:00", "09:00")).toBe(false);
  });
  it("tryb systemowy idzie za trybem ciemnym, wyłączony harmonogram nic nie wybiera", () => {
    expect(scheduledSkin({ ...base, mode: "system" }, at(12), true)).toBe("zorza");
    expect(scheduledSkin({ ...base, mode: "system" }, at(23), false)).toBe("zeszyt");
    expect(scheduledSkin({ ...base, enabled: false }, at(23), false)).toBeNull();
  });
});

describe("styl na noc — ręczny wybór", () => {
  beforeEach(() => {
    setSkinSchedule({ ...base, enabled: false });
    setSkin("zeszyt");
  });
  it("ręczny wybór przy włączonym harmonogramie zmienia styl bieżącej pory, a nie go wyłącza", () => {
    // Tryb „system” z jasnym systemem (jsdom): jest dzień.
    setSkinSchedule({ ...base, mode: "system" });
    expect(skinStore.get()).toBe("zeszyt");
    setSkin("kafle");
    expect(skinScheduleStore.get()).toEqual(expect.objectContaining({ enabled: true, day: "kafle", night: "zorza" }));
  });
});

describe("styl na noc — wg słońca (plan motywów 3.2)", () => {
  // Warszawa, przesilenie letnie: zachód ~21:00 czasu letniego (wynik wzoru zweryfikowanego na Londynie).
  const sunny = (y: number, mo: number, d: number, h: number, m = 0) => new Date(y, mo, d, h, m);
  const warsaw = { ...base, mode: "sun" as const };

  it("latem w Warszawie dzień trwa po wschodzie i zachodzie około 21:20", () => {
    expect(isNight(warsaw, sunny(2026, 5, 21, 12), false)).toBe(false);
    expect(isNight(warsaw, sunny(2026, 5, 21, 22, 0), false)).toBe(true);
    expect(isNight(warsaw, sunny(2026, 5, 21, 3, 0), false)).toBe(true);
    expect(isNight(warsaw, sunny(2026, 5, 21, 5, 0), false)).toBe(false);
  });

  it("zimą noc zaczyna się już po 16:00", () => {
    expect(isNight(warsaw, sunny(2026, 11, 21, 15, 0), false)).toBe(false);
    expect(isNight(warsaw, sunny(2026, 11, 21, 17, 0), false)).toBe(true);
  });

  it("miasto z listy zmienia porę: Gdańsk ma wschód i zachód inaczej niż Kraków", () => {
    const krakow = { ...warsaw, city: "krakow" };
    const gdansk = { ...warsaw, city: "gdansk" };
    // 21:10 CEST: Kraków (zachód ~20:53) jest już w nocy, Gdańsk (zachód ~21:23) jeszcze w dzień.
    const t = sunny(2026, 5, 21, 21, 10);
    expect(isNight(krakow, t, false)).toBe(true);
    expect(isNight(gdansk, t, false)).toBe(false);
    expect(isNight(warsaw, sunny(2026, 5, 21, 21, 40), false)).toBe(true);
  });

  it("nieznane miasto wraca do Warszawy, a wartość sun z zapisu zostaje", () => {
    expect(isNight({ ...warsaw, city: "nieistniejace" }, sunny(2026, 5, 21, 22), false)).toBe(true);
  });
});
