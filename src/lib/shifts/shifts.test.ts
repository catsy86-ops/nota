import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, applyPattern, currentAndNextShift, daysUntilMonthEnd, easterSunday,
  entryMinutes, formatDuration, formatHoursShort, holidayName, migrate, monthSummary, nightMinutes, parseHm,
  shiftMinutes, workNormMinutes, buildShiftsIcs, exportableShiftDays, SHIFT_COLORS, shiftInk, contrastRatio, type ShiftData,
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
    expect(s.overtimeMinutes).toBe(0);
    expect(s.earnings).toBe(17 * 30 + 8 * 40);
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

  it("dolicza dopłatę za nadgodziny ponad normę", () => {
    // Luty 2026: 20 dni roboczych = 160 h; 21 dni po 8 h = 8 h nadgodzin.
    const days = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { type: "d" }]));
    const s = monthSummary(data({ types: [day], hourlyRate: 30, overtimeMultiplier: 1.5, days }), 2026, 1);
    expect(s.normMinutes).toBe(160 * 60);
    expect(s.overtimeMinutes).toBe(8 * 60);
    expect(s.earnings).toBe(168 * 30 + 8 * 15);
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
    const m = migrate({ types: [{ nope: 1 }], days: { a: 5, b: { type: "d", extraMin: "x" } }, hourlyRate: -3 });
    expect(m.types).toEqual([]);
    expect(m.days).toEqual({ b: { type: "d" } });
    expect(m.hourlyRate).toBe(0);
    expect(migrate(null).types.length).toBe(DEFAULT_SHIFT_TYPES.length);
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
