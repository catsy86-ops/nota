import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, applyPattern, currentAndNextShift, daysUntilMonthEnd, easterSunday,
  entryMinutes, formatDuration, formatHoursShort, holidayName, migrate, monthSummary, nightMinutes, parseHm,
  shiftMinutes, workNormMinutes, buildShiftsIcs, shortRests, cancelledShiftDays, exportedAfter, exportableShiftDays, SHIFT_COLORS, shiftInk, contrastRatio, dstShiftMinutes, restoreShifts, setDayShift, shiftStore, type ShiftData,
} from "./index";

const [day, afternoon, night, leave] = DEFAULT_SHIFT_TYPES;
const data = (patch: Partial<ShiftData>): ShiftData => ({ ...EMPTY_SHIFT_DATA, ...patch });

describe("czas zmian", () => {
  it("parsuje HH:MM i odrzuca śmieci", () => {
    expect(parseHm("06:30")).toBe(390);
    expect(parseHm("7:05")).toBe(425);
    expect(parseHm("24:00")).toBeNaN();
    expect(parseHm("abc")).toBeNaN();
  });

  it("liczy długość zmiany — przez północ i z przerwą", () => {
    expect(shiftMinutes(day)).toBe(480);
    expect(shiftMinutes(night)).toBe(480);
    expect(shiftMinutes({ start: "07:00", end: "19:00", breakMin: 30 })).toBe(690);
    expect(shiftMinutes({ start: "08:00", end: "08:00", breakMin: 0 })).toBe(24 * 60);
    expect(shiftMinutes({ start: "xx", end: "08:00", breakMin: 0 })).toBe(0);
  });

  it("uwzględnia odchylenie dnia, ale nie schodzi poniżej zera", () => {
    expect(entryMinutes(day, { extraMin: 90 })).toBe(570);
    expect(entryMinutes(day, { extraMin: -600 })).toBe(0);
  });

  it("liczy godziny nocne 22–6", () => {
    expect(nightMinutes(day)).toBe(0);
    expect(nightMinutes(afternoon)).toBe(0);
    expect(nightMinutes(night)).toBe(480);
    expect(nightMinutes({ start: "04:00", end: "12:00" })).toBe(120);
    expect(nightMinutes({ start: "19:00", end: "07:00" })).toBe(480);
  });

  it("formatuje czas", () => {
    expect(formatDuration(510)).toBe("8 h 30 min");
    expect(formatDuration(480)).toBe("8 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(-30)).toBe("−30 min");
    expect(formatHoursShort(510)).toBe("8,5");
  });
});

describe("święta i wymiar czasu pracy", () => {
  it("wyznacza Wielkanoc", () => {
    expect(easterSunday(2024).toDateString()).toBe(new Date(2024, 2, 31).toDateString());
    expect(easterSunday(2025).toDateString()).toBe(new Date(2025, 3, 20).toDateString());
    expect(easterSunday(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
  });

  it("zna święta ruchome i Wigilię od 2025", () => {
    expect(holidayName("2026-06-04")).toBe("Boże Ciało");
    expect(holidayName("2026-04-06")).toBe("Poniedziałek Wielkanocny");
    expect(holidayName("2025-12-24")).toBe("Wigilia");
    expect(holidayName("2024-12-24")).toBeUndefined();
    expect(holidayName("2026-10-09")).toBeUndefined();
  });

  it("Trzech Króli jest wolne dopiero od 2011", () => {
    expect(holidayName("2011-01-06")).toBe("Trzech Króli");
    expect(holidayName("2010-01-06")).toBeUndefined();
  });

  it("liczy wymiar zgodnie z art. 130 KP", () => {
    expect(workNormMinutes(2026, 9)).toBe(176 * 60); // październik 2026
    expect(workNormMinutes(2026, 10)).toBe(160 * 60); // listopad: 11.11 w środę, 1.11 w niedzielę
    expect(workNormMinutes(2025, 11)).toBe(160 * 60); // grudzień 2025 z Wigilią
  });
});

describe("cykle", () => {
  it("nakłada cykl i czyści dni wolne, nie ruszając wejścia", () => {
    const before = { "2026-10-03": { type: "p" }, "2026-10-01": { type: "d", note: "zostaje" } };
    const after = applyPattern(before, ["d", null], "2026-10-01", 4);
    expect(after).toEqual({ "2026-10-01": { type: "d", note: "zostaje" }, "2026-10-03": { type: "d" } });
    expect(before["2026-10-03"].type).toBe("p");
  });

  it("przechodzi przez zmianę czasu bez gubienia dni", () => {
    const after = applyPattern({}, ["n"], "2026-10-24", 3);
    expect(Object.keys(after).sort()).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });

  it("liczy dni do końca miesiąca", () => {
    expect(daysUntilMonthEnd("2026-10-01")).toBe(31);
    expect(daysUntilMonthEnd("2026-10-30")).toBe(2);
    expect(daysUntilMonthEnd("2026-10-01", 2)).toBe(31 + 30 + 31);
  });
});

describe("podsumowanie miesiąca", () => {
  it("liczy godziny, nocne, nieobecności i zarobek ze stawką zmiany", () => {
    const s = monthSummary(data({
      types: [day, { ...night, rate: 40 }, leave],
      hourlyRate: 30,
      days: {
        "2026-10-01": { type: "d" },
        "2026-10-02": { type: "d", extraMin: 60 },
        "2026-10-03": { type: "n" },
        "2026-10-05": { type: "u" },
        "2026-11-01": { type: "d" },
        "2026-10-04": { type: "nie-ma" },
      },
    }), 2026, 9);
    expect(s.daysWorked).toBe(3);
    expect(s.minutes).toBe(3 * 480 + 60);
    expect(s.nightMinutes).toBe(480);
    expect(s.absenceDays).toBe(1);
    expect(s.normMinutes).toBe((176 - 8) * 60);
    // 2.10 z odchyleniem +60 min: 9 h w dobie = 1 h nadgodzin dobowych.
    expect(s.overtimeMinutes).toBe(60);
    expect(s.dailyOvertimeMinutes).toBe(60);
    expect(s.earnings).toBe(17 * 30 + 8 * 40 + 30 * 0.5);
    expect(s.byType.map((t) => [t.type.id, t.count])).toEqual([["d", 2], ["n", 1], ["u", 1]]);
  });

  it("nieobecność w sobotę, niedzielę i święto nie obniża normy", () => {
    // L4 zaznaczone ciągiem 1–14.10.2026: 10 dni roboczych, 4 dni weekendu.
    const days = Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`2026-10-${String(i + 1).padStart(2, "0")}`, { type: "u" }]));
    expect(monthSummary(data({ types: [leave], days }), 2026, 9).normMinutes).toBe((176 - 10 * 8) * 60);
    // Urlop w Wigilię (święto od 2025 r.) — norma grudnia już ją pomija.
    const xmas = monthSummary(data({ types: [leave], days: { "2026-12-24": { type: "u" } } }), 2026, 11);
    expect(xmas.normMinutes).toBe(workNormMinutes(2026, 11));
  });

  it("liczy nadgodziny dobowe w dobie pracowniczej", () => {
    // P pon. 14–22, D wt. 6–14: wtorkowe 8 h mieszczą się w dobie poniedziałkowej.
    const s = monthSummary(data({ days: { "2026-10-05": { type: "p" }, "2026-10-06": { type: "d" } } }), 2026, 9);
    expect(s.dailyOvertimeMinutes).toBe(480);
    expect(s.overtimeMinutes).toBe(480);
    // Jeden dzień 10 h.
    const ten = monthSummary(data({ days: { "2026-10-05": { type: "d", extraMin: 120 } } }), 2026, 9);
    expect(ten.dailyOvertimeMinutes).toBe(120);
    // Codziennie ta sama zmiana — doby się nie nakładają.
    const same = monthSummary(data({ days: { "2026-10-05": { type: "d" }, "2026-10-06": { type: "d" } } }), 2026, 9);
    expect(same.dailyOvertimeMinutes).toBe(0);
  });

  it("w systemie równoważnym dwunastki z grafiku nie są nadgodzinami", () => {
    const twelve = { ...day, id: "x", start: "07:00", end: "19:00" };
    const days = { "2026-10-05": { type: "x" }, "2026-10-07": { type: "x", extraMin: 60 } };
    expect(monthSummary(data({ types: [twelve], days }), 2026, 9).dailyOvertimeMinutes).toBe(4 * 60 + 5 * 60);
    expect(monthSummary(data({ types: [twelve], days, workSystem: "equivalent" }), 2026, 9).dailyOvertimeMinutes).toBe(60);
  });

  it("dolicza dopłatę za nadgodziny ponad normę", () => {
    // Luty 2026: 20 dni roboczych = 160 h; 21 dni po 8 h = 8 h nadgodzin.
    const days = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { type: "d" }]));
    const s = monthSummary(data({ types: [day], hourlyRate: 30, overtimeMultiplier: 1.5, days }), 2026, 1);
    expect(s.normMinutes).toBe(160 * 60);
    expect(s.overtimeMinutes).toBe(8 * 60);
    expect(s.earnings).toBe(168 * 30 + 8 * 15);
  });
});

describe("odpoczynek dobowy", () => {
  it("wskazuje zmianę po mniej niż 11 h przerwy, z odchyleniem", () => {
    const d = data({ days: {
      "2026-09-30": { type: "p" }, // 14–22
      "2026-10-01": { type: "d" }, // 6–14: 8 h przerwy
      "2026-10-05": { type: "p" },
      "2026-10-06": { type: "n" }, // 22:00, 24 h po popołudniówce
      "2026-10-08": { type: "p", extraMin: 60 }, // do 23:00
      "2026-10-09": { type: "d" }, // 6:00: 7 h przerwy
      "2026-11-02": { type: "d" },
    } });
    expect(shortRests(d)).toEqual([
      { dayKey: "2026-10-01", restMinutes: 480 },
      { dayKey: "2026-10-09", restMinutes: 420 },
    ]);
    expect(monthSummary(d, 2026, 9).shortRests.map((r) => r.dayKey)).toEqual(["2026-10-01", "2026-10-09"]);
    expect(monthSummary(d, 2026, 8).shortRests).toEqual([]);
  });
});

describe("bieżąca i następna zmiana", () => {
  const d = data({ days: { "2026-10-09": { type: "n" }, "2026-10-12": { type: "d" }, "2026-10-10": { type: "u" } } });

  it("widzi nocną zmianę z wczoraj jako trwającą", () => {
    const { current, next } = currentAndNextShift(d, new Date(2026, 9, 10, 3, 0));
    expect(current?.dayKey).toBe("2026-10-09");
    expect(next?.dayKey).toBe("2026-10-12");
  });

  it("pomija nieobecności i zwraca najbliższą zmianę", () => {
    const { current, next } = currentAndNextShift(d, new Date(2026, 9, 9, 12, 0));
    expect(current).toBeNull();
    expect(next?.dayKey).toBe("2026-10-09");
  });
});

describe("migracja", () => {
  it("podnosi v1 (dzień = id zmiany) do v2", () => {
    const m = migrate({ types: [day], days: { "2026-10-01": "d" }, hourlyRate: 25 });
    expect(m.version).toBe(2);
    expect(m.days["2026-10-01"]).toEqual({ type: "d" });
    expect(m.hourlyRate).toBe(25);
    expect(m.overtimeMultiplier).toBe(1.5);
    expect(m.patterns.length).toBeGreaterThan(0);
  });

  it("odrzuca śmieci", () => {
    const m = migrate({ types: [{ nope: 1 }], days: { "2026-10-01": 5, "2026-10-02": { type: "d", extraMin: "x" } }, hourlyRate: -3 });
    expect(m.types).toEqual([]);
    expect(m.days).toEqual({ "2026-10-02": { type: "d" } });
    expect(m.hourlyRate).toBe(0);
    expect(migrate(null).types.length).toBe(DEFAULT_SHIFT_TYPES.length);
  });

  it("odrzuca złe klucze dni, także __proto__", () => {
    const m = migrate(JSON.parse('{"days":{"__proto__":{"type":"d"},"wczoraj":{"type":"d"},"2026-10-01":{"type":"d"}}}'));
    expect(Object.keys(m.days)).toEqual(["2026-10-01"]);
    expect(Object.getPrototypeOf(m.days)).toBe(Object.prototype);
  });

  it("naprawia stawkę i przerwę, zostawia pola nowszej wersji", () => {
    const m = migrate({
      types: [{ ...day, rate: "abc", breakMin: null, przyszłość: 1 }],
      days: { "2026-10-01": { type: "d", tag: "x" } },
      nowePole: [1],
    });
    expect(m.types[0].rate).toBeUndefined();
    expect(m.types[0].breakMin).toBe(0);
    expect((m.types[0] as unknown as Record<string, unknown>).przyszłość).toBe(1);
    expect(m.days["2026-10-01"]).toEqual({ type: "d", tag: "x" });
    expect((m as unknown as Record<string, unknown>).nowePole).toEqual([1]);
    expect(monthSummary(data({ types: m.types, hourlyRate: 30, days: m.days }), 2026, 9).earnings).toBe(8 * 30);
  });
});

describe("zmiana czasu", () => {
  it("noc przy zmianie na czas zimowy trwa 9 h, na letni 7 h", () => {
    expect(dstShiftMinutes(night, "2026-10-24")).toBe(60);
    expect(dstShiftMinutes(night, "2026-03-28")).toBe(-60);
    expect(dstShiftMinutes(night, "2026-10-09")).toBe(0);
    const oct = monthSummary(data({ types: [night], days: { "2026-10-24": { type: "n" } } }), 2026, 9);
    expect(oct.minutes).toBe(540);
    expect(oct.nightMinutes).toBe(540);
    const mar = monthSummary(data({ types: [night], days: { "2026-03-28": { type: "n" } } }), 2026, 2);
    expect(mar.minutes).toBe(420);
  });
});

describe("akcje grafiku", () => {
  it("inny rodzaj zmiany zachowuje notatkę, ale nie odchylenie", () => {
    restoreShifts(data({ types: [day, night], days: { "2026-10-01": { type: "d", note: "zastępstwo", extraMin: 120 } } }));
    setDayShift("2026-10-01", "n");
    expect(shiftStore.get().days["2026-10-01"]).toEqual({ type: "n", note: "zastępstwo" });
  });
});

describe("eksport .ics", () => {
  const d = data({
    days: {
      "2026-09-30": { type: "d" },
      "2026-10-09": { type: "n", note: "zastępstwo, hala 2", extraMin: 30 },
      "2026-10-10": { type: "u" },
    },
  });

  it("bierze dni od wskazanego, posortowane", () => {
    expect(exportableShiftDays(d, "2026-10-01")).toEqual(["2026-10-09", "2026-10-10"]);
  });

  it("zmiana przez północ kończy się następnego dnia, z odchyleniem i alarmem", () => {
    const ics = buildShiftsIcs(d, ["2026-10-09"], { now: Date.UTC(2026, 9, 1) });
    expect(ics).toContain("UID:shift-2026-10-09@notatnik");
    expect(ics).toContain("DTSTART:20261009T220000");
    expect(ics).toContain("DTEND:20261010T063000");
    expect(ics).toContain("SUMMARY:Zmiana: Noc");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics).toContain("DESCRIPTION:zastępstwo\\, hala 2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("nieobecność to wydarzenie całodniowe bez alarmu", () => {
    const ics = buildShiftsIcs(d, ["2026-10-10"]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
    expect(ics).toContain("DTEND;VALUE=DATE:20261011");
    expect(ics).not.toContain("VALARM");
  });

  it("notatka przed VALARM, SEQUENCE rośnie z czasem eksportu", () => {
    const a = buildShiftsIcs(d, ["2026-10-09"], { now: Date.UTC(2026, 9, 1) });
    expect(a.indexOf("DESCRIPTION:zastępstwo")).toBeLessThan(a.indexOf("BEGIN:VALARM"));
    const seq = (ics: string) => Number(/SEQUENCE:(\d+)/.exec(ics)?.[1]);
    const b = buildShiftsIcs(d, ["2026-10-09"], { now: Date.UTC(2026, 9, 2) });
    expect(seq(b)).toBeGreaterThan(seq(a));
    expect(a).toContain("LAST-MODIFIED:20261001T000000Z");
  });

  it("odwołuje wyeksportowane wcześniej dni, których już nie ma", () => {
    const exported = ["2026-09-30", "2026-10-05", "2026-10-09"];
    expect(cancelledShiftDays(d, exported, "2026-10-01")).toEqual(["2026-10-05"]);
    const ics = buildShiftsIcs(d, ["2026-10-09"], { cancelled: ["2026-10-05"] });
    expect(ics).toMatch(/UID:shift-2026-10-05@notatnik[\s\S]*STATUS:CANCELLED/);
    expect(exportedAfter(exported, ["2026-10-09", "2026-10-10"], "2026-10-01")).toEqual(["2026-09-30", "2026-10-09", "2026-10-10"]);
  });

  it("samotne CR w notatce nie łamie linii", () => {
    const ics = buildShiftsIcs(data({ days: { "2026-10-09": { type: "d", note: "a\rb" } } }), ["2026-10-09"]);
    expect(ics).toContain("DESCRIPTION:a\\nb");
  });
});

describe("kolory zmian", () => {
  it("skrót na każdym kolorze palety ma kontrast co najmniej 4,5:1", () => {
    for (const c of SHIFT_COLORS) expect(contrastRatio(c, shiftInk(c)), c).toBeGreaterThanOrEqual(4.5);
  });

  it("na jasnym kolorze daje ciemny odcień tego samego koloru, na ciemnym biel", () => {
    expect(shiftInk("#f59e0b")).not.toBe("#fff");
    expect(shiftInk("#1e293b")).toBe("#fff");
    expect(shiftInk("zepsuty")).toBe("#fff");
  });
});
