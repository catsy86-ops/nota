import { describe, expect, it } from "vitest";

// Strefa czasu, w której liczymy przeskok (T 1.2): 29.03.2026 o 02:00 zegar przechodzi na 03:00.
process.env.TZ = "Europe/Warsaw";

const local = (d: number, h: number, min = 0) => new Date(2026, 2, d, h, min).getTime();
const hm = (at: number) => { const x = new Date(at); return `${x.getDate()}.${x.getMonth() + 1} ${x.getHours()}:${String(x.getMinutes()).padStart(2, "0")}`; };

describe("seria przez zmianę czasu (T 1.2)", () => {
  it("bez kotwicy seria dryfuje: 2:30 w dniu przeskoku → 3:30 na zawsze", async () => {
    const { getNextReminderTime } = await import("./reminderRepeat");
    const onShift = getNextReminderTime(local(28, 2, 30), "daily");
    expect(hm(onShift)).toBe("29.3 3:30");
    expect(hm(getNextReminderTime(onShift, "daily"))).toBe("30.3 3:30");
  });

  it("z kotwicą 2:30 następnego dnia wraca na 2:30", async () => {
    const { getNextReminderTime } = await import("./reminderRepeat");
    const anchor = 2 * 60 + 30;
    const onShift = getNextReminderTime(local(28, 2, 30), "daily", undefined, anchor);
    expect(hm(onShift)).toBe("29.3 3:30");
    expect(hm(getNextReminderTime(onShift, "daily", undefined, anchor))).toBe("30.3 2:30");
  });

  it("kotwica zachowuje godzinę w tygodniowej i miesięcznej serii", async () => {
    const { getNextReminderTime } = await import("./reminderRepeat");
    const anchor = 9 * 60 + 15;
    expect(hm(getNextReminderTime(local(26, 9, 15), "weekly", undefined, anchor))).toBe("2.4 9:15");
    expect(hm(getNextReminderTime(local(26, 9, 15), "monthly", undefined, anchor))).toBe("26.4 9:15");
  });

  it("krok przesunięty przez zmianę czasu nie zmienia kotwicy; zwykły krok tak", async () => {
    const { isDstShiftedOccurrence, minutesOfDay } = await import("./reminderRepeat");
    const anchor = 2 * 60 + 30;
    expect(isDstShiftedOccurrence(anchor, local(29, 3, 30))).toBe(true);
    expect(isDstShiftedOccurrence(anchor, local(30, 2, 30))).toBe(false);
    expect(isDstShiftedOccurrence(anchor, local(29, 9, 0))).toBe(false);
    expect(minutesOfDay(local(29, 3, 30))).toBe(210);
  });

  it("seriesMinutes: z zapisu, a bez niego z terminu bazowego", async () => {
    const { seriesMinutes } = await import("./reminderRepeat");
    expect(seriesMinutes({ reminder: local(28, 3, 30), reminderTime: 150 })).toBe(150);
    expect(seriesMinutes({ reminder: local(28, 9, 5) })).toBe(9 * 60 + 5);
    expect(seriesMinutes({ reminder: null })).toBeUndefined();
  });
});
