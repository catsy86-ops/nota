import { beforeEach, describe, expect, it } from "vitest";
import { isNightHours, scheduledSkin, setSkinSchedule, skinScheduleStore, type SkinSchedule } from "@/lib/skinSchedule";
import { setSkin, skinStore } from "@/lib/skins";

const base: SkinSchedule = { enabled: true, day: "zeszyt", night: "zorza", mode: "hours", from: "20:00", to: "07:00" };
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
