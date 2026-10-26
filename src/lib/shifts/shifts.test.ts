import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, applyPattern, currentAndNextShift, daysUntilMonthEnd, easterSunday,
  entryMinutes, formatDuration, formatHoursShort, holidayName, migrate, monthSummary, nightMinutes, parseHm,
  shiftMinutes, workNormMinutes, breakOffset, buildShiftsIcs, shortRests, settlementPeriod, isNormDay, cancelledShiftDays, exportedAfter, exportableShiftDays, SHIFT_COLORS, shiftInk, contrastRatio, dstShiftMinutes, entryMinutesOn, icsScope, recentlyEndedShift, restoreShifts, setDayShift, shiftStore, type ShiftData,
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

  it("przerwa z godziną odejmuje się od pory nocnej, bez godziny — nie", () => {
    expect(nightMinutes({ ...night, breakMin: 30 })).toBe(480);
    expect(nightMinutes({ ...night, breakMin: 30, breakAt: "02:00" })).toBe(450);
    expect(nightMinutes({ start: "18:00", end: "06:00", breakMin: 60, breakAt: "20:00" })).toBe(480);
    // Przerwa poza zmianą jest ignorowana.
    expect(nightMinutes({ ...night, breakMin: 30, breakAt: "05:45" })).toBe(480);
    expect(breakOffset({ ...night, breakMin: 30, breakAt: "02:00" })).toBe(240);
    expect(breakOffset({ ...night, breakMin: 30, breakAt: "05:45" })).toBeNull();
    expect(migrate({ types: [{ ...night, breakAt: "zła" }] }).types[0].breakAt).toBeUndefined();
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

  it("przerwa z godziną przesuwa nadgodziny w czasie", () => {
    // 14:00–23:00 z godzinną przerwą: 8 h pracy, 0 nadgodzin.
    const late = { ...afternoon, id: "x", end: "23:00", breakMin: 60 };
    const at = (t: typeof late) => monthSummary(data({ types: [t], hourlyRate: 60, days: { "2026-10-05": { type: "x", extraMin: 60 } } }), 2026, 9);
    // Przerwa bez godziny skraca koniec: nadgodzina to 22–23 → w nocy.
    expect(at(late).overtime100Minutes).toBe(60);
    // Przerwa o 22:00 — praca kończy się o 24:00, nadgodzina 23–24 i tak w nocy.
    expect(at({ ...late, breakAt: "22:00" }).overtime100Minutes).toBe(60);
    // Przerwa o 18:00 — tak samo: ostatnia godzina pracy to 23–24.
    expect(at({ ...late, breakAt: "18:00" }).overtime100Minutes).toBe(60);
    // Doba pracownicza: P pon. 14–22 i ranna wt. 6–14 z przerwą 9–10 — w dobie poniedziałkowej
    // wtorek wnosi 6:00–14:00 minus przerwę = 7 h nadgodzin; bez godziny przerwy — 8 h.
    const morning = { ...day, id: "m", end: "15:00", breakMin: 60 };
    const doba = (t: typeof morning) => monthSummary(data({ types: [afternoon, t], days: { "2026-10-05": { type: "p" }, "2026-10-06": { type: "m" } } }), 2026, 9).dailyOvertimeMinutes;
    expect(doba({ ...morning, breakAt: "09:00" })).toBe(7 * 60);
    expect(doba(morning)).toBe(8 * 60);
  });

  it("w systemie równoważnym dwunastki z grafiku nie są nadgodzinami", () => {
    const twelve = { ...day, id: "x", start: "07:00", end: "19:00" };
    const days = { "2026-10-05": { type: "x" }, "2026-10-07": { type: "x", extraMin: 60 } };
    expect(monthSummary(data({ types: [twelve], days }), 2026, 9).dailyOvertimeMinutes).toBe(4 * 60 + 5 * 60);
    expect(monthSummary(data({ types: [twelve], days, workSystem: "equivalent" }), 2026, 9).dailyOvertimeMinutes).toBe(60);
  });

  it("ponad normę okresu dodatek 100%", () => {
    // Luty 2026: 20 dni roboczych = 160 h; 21 dni po 8 h = 8 h nadgodzin.
    const days = Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { type: "d" }]));
    const s = monthSummary(data({ types: [day], hourlyRate: 30, days }), 2026, 1);
    expect(s.normMinutes).toBe(160 * 60);
    expect(s.overtimeMinutes).toBe(8 * 60);
    expect(s.overtime100Minutes).toBe(8 * 60);
    expect(s.earnings).toBe(168 * 30 + 8 * 30);
  });

  it("nadgodziny dobowe w nocy, w niedzielę i w święto mają 100%, pozostałe 50%", () => {
    const at = (days: ShiftData["days"]) => monthSummary(data({ hourlyRate: 60, days }), 2026, 9);
    // Pon. popołudnie do północy: 22–24 to pora nocna.
    const night = at({ "2026-10-05": { type: "p", extraMin: 120 } });
    expect(night.overtime100Minutes).toBe(120);
    expect(night.earnings).toBe(10 * 60 + 2 * 60);
    // Pon. ranna do 15:00 — zwykłe 50%.
    const plain = at({ "2026-10-05": { type: "d", extraMin: 60 } });
    expect(plain.overtime100Minutes).toBe(0);
    expect(plain.earnings).toBe(9 * 60 + 30);
    // Niedziela 4.10. wolna wg grafiku (zmiana dopisana poza planem) — 100%; zaplanowana — 50%.
    expect(at({ "2026-10-04": { type: "d", extraMin: 60, offSchedule: true } }).overtime100Minutes).toBe(60);
    expect(at({ "2026-10-04": { type: "d", extraMin: 60 } }).overtime100Minutes).toBe(0);
    // Sobotnia noc przedłużona do 8:00 wchodzi w niedzielę, w której nie ma zmiany.
    expect(at({ "2026-10-03": { type: "n", extraMin: 120 } }).overtime100Minutes).toBe(120);
    // Noc pon.→wt. przedłużona do 7:00: ostatnia godzina już poza porą nocną.
    expect(at({ "2026-10-05": { type: "n", extraMin: 60 } }).overtime100Minutes).toBe(0);
    // Nadgodziny wniesione do cudzej doby to początek następnej zmiany: P pon., D wt. 6–14 → 6:00–14:00 w dzień.
    expect(at({ "2026-10-05": { type: "p" }, "2026-10-06": { type: "d" } }).overtime100Minutes).toBe(0);
    // Wszystkich Świętych 1.11 (niedziela 2026) i 11.11 (środa).
    expect(monthSummary(data({ days: { "2026-11-11": { type: "d", extraMin: 30, offSchedule: true } } }), 2026, 10).overtime100Minutes).toBe(30);
    expect(monthSummary(data({ days: { "2026-11-11": { type: "d", extraMin: 30 } } }), 2026, 10).overtime100Minutes).toBe(0);
    expect(migrate({ days: { "2026-11-11": { type: "d", offSchedule: "tak" } } }).days["2026-11-11"]).toEqual({ type: "d" });
  });

  it("dzień wolny za niedzielę ma 100%", () => {
    const at = (days: ShiftData["days"]) => monthSummary(data({ days }), 2026, 9).overtime100Minutes;
    // Wtorek 6.10. wolny w zamian za niedzielę — nadgodzina 14–15 ma 100%; zwykły wtorek — 50%.
    expect(at({ "2026-10-06": { type: "d", extraMin: 60, offSchedule: true, inLieu: true } })).toBe(60);
    expect(at({ "2026-10-06": { type: "d", extraMin: 60 } })).toBe(0);
    expect(migrate({ days: { "2026-10-06": { type: "d", inLieu: "tak" } } }).days["2026-10-06"]).toEqual({ type: "d" });
  });

  it("pora nocna wg regulaminu (art. 151⁷)", () => {
    expect(nightMinutes(afternoon, 21)).toBe(60);
    expect(nightMinutes(day, 23)).toBe(60);
    expect(nightMinutes(night, 21)).toBe(420);
    // Pon. popołudnie do 23:00 — przy nocy 23–7 nadgodzina 22–23 to już zwykłe 50%.
    const days = { "2026-10-05": { type: "p", extraMin: 60 } };
    expect(monthSummary(data({ days }), 2026, 9).overtime100Minutes).toBe(60);
    expect(monthSummary(data({ days, nightFrom: 23 }), 2026, 9).overtime100Minutes).toBe(0);
    expect(monthSummary(data({ days, nightFrom: 23 }), 2026, 9).nightMinutes).toBe(0);
    expect(migrate({ nightFrom: 20 }).nightFrom).toBe(22);
    expect(migrate({ nightFrom: 21 }).nightFrom).toBe(21);
  });

  it("niedziela liczy się od ustalonej godziny (art. 151¹⁰)", () => {
    // Sobotnia noc 3.10. przedłużona do 9:00: nadgodziny 6–9 w niedzielę rano.
    const days = { "2026-10-03": { type: "n", extraMin: 180 } };
    expect(monthSummary(data({ days }), 2026, 9).overtime100Minutes).toBe(180);
    // Niedziela od 8:00 — 6–8 to jeszcze sobota (50%), 8–9 już niedziela.
    expect(monthSummary(data({ days, sundayFrom: 8 }), 2026, 9).overtime100Minutes).toBe(60);
    expect(migrate({}).sundayFrom).toBe(6);
    expect(migrate({ sundayFrom: 24 }).sundayFrom).toBe(6);
    expect(migrate({ sundayFrom: 0 }).sundayFrom).toBe(0);
  });
});

describe("okres rozliczeniowy", () => {
  /** Wszystkie dni normy miesiąca jako zmiana „Dzień”, bez `skip` pierwszych. */
  const normDays = (year: number, month: number, skip = 0) => {
    const keys: string[] = [];
    for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (isNormDay(key)) keys.push(key);
    }
    return Object.fromEntries(keys.slice(skip).map((k) => [k, { type: "d" }]));
  };

  it("nadwyżkę z jednego miesiąca wyrównuje niedobór w innym, rozlicza ostatni", () => {
    // Styczeń–marzec 2026: dwie soboty ponad normę w styczniu, luty o dwa dni krótszy.
    const days = { ...normDays(2026, 0), "2026-01-10": { type: "d" }, "2026-01-17": { type: "d" }, ...normDays(2026, 1, 2), ...normDays(2026, 2) };
    const q = data({ settlementMonths: 3, hourlyRate: 30, days });
    expect(monthSummary(q, 2026, 0).overtimeMinutes).toBe(0);
    const mar = monthSummary(q, 2026, 2);
    expect(mar.overtimeMinutes).toBe(0);
    expect(mar.period).toMatchObject({ startMonth: 0, months: 3, isLast: true });
    expect(mar.period!.minutes).toBe(mar.period!.normMinutes);
    // Ten sam grafik przy okresie miesięcznym: styczeń ma 16 h nadgodzin.
    expect(monthSummary(data({ days }), 2026, 0).overtimeMinutes).toBe(16 * 60);
  });

  it("przekroczenie normy okresu wychodzi w ostatnim miesiącu, ze 100%", () => {
    const days = { ...normDays(2026, 0), "2026-01-10": { type: "d" }, ...normDays(2026, 1), ...normDays(2026, 2) };
    const q = data({ settlementMonths: 3, hourlyRate: 30, days });
    const jan = monthSummary(q, 2026, 0);
    expect(jan.overtimeMinutes).toBe(0);
    expect(jan.period?.isLast).toBe(false);
    const mar = monthSummary(q, 2026, 2);
    expect(mar.overtimeMinutes).toBe(8 * 60);
    expect(mar.overtime100Minutes).toBe(8 * 60);
    expect(mar.earnings).toBe(mar.minutes / 60 * 30 + 8 * 30);
  });

  it("okresy liczą się od stycznia", () => {
    expect(settlementPeriod(2026, 4, 4)).toEqual({ year: 2026, startMonth: 4, months: 4 });
    expect(settlementPeriod(2026, 11, 6)).toEqual({ year: 2026, startMonth: 6, months: 6 });
    expect(migrate({ settlementMonths: 5 }).settlementMonths).toBe(1);
  });

  it("okresy od innego miesiąca, także przez Nowy Rok", () => {
    // Kwartały od lutego: lut–kwi, maj–lip, sie–paź, lis–sty.
    expect(settlementPeriod(2026, 1, 3, 1)).toEqual({ year: 2026, startMonth: 1, months: 3 });
    expect(settlementPeriod(2026, 3, 3, 1)).toEqual({ year: 2026, startMonth: 1, months: 3 });
    expect(settlementPeriod(2027, 0, 3, 1)).toEqual({ year: 2026, startMonth: 10, months: 3 });
    expect(settlementPeriod(2026, 0, 12, 6)).toEqual({ year: 2025, startMonth: 6, months: 12 });
    expect(migrate({ settlementStart: 12 }).settlementStart).toBe(0);
    expect(migrate({ settlementStart: 1.5 }).settlementStart).toBe(0);
    expect(migrate({ settlementStart: 10 }).settlementStart).toBe(10);
  });

  it("okres przez Nowy Rok rozlicza się w styczniu", () => {
    // Listopad 2026 – styczeń 2027, jedna sobota ponad normę w listopadzie. Święto 26.12 w sobotę
    // obniża normę grudnia o 8 h (art. 130 § 2), więc grudzień ma o jeden dzień mniej.
    const days = { ...normDays(2026, 10), "2026-11-07": { type: "d" }, ...normDays(2026, 11, 1), ...normDays(2027, 0) };
    const q = data({ settlementMonths: 3, settlementStart: 1, days });
    expect(monthSummary(q, 2026, 11).overtimeMinutes).toBe(0);
    const jan = monthSummary(q, 2027, 0);
    expect(jan.period).toMatchObject({ year: 2026, startMonth: 10, isLast: true });
    expect(jan.overtimeMinutes).toBe(8 * 60);
    expect(jan.period!.minutes - jan.period!.normMinutes).toBe(8 * 60);
  });
});

describe("niepełny etat", () => {
  it("norma proporcjonalna, ponad nią godziny ponadwymiarowe, ponad pełny etat nadgodziny", () => {
    // Luty 2026: 160 h normy pełnego etatu, pół etatu = 80 h.
    const feb = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { type: "d" }]));
    const half = (days: ShiftData["days"]) => monthSummary(data({ fte: 1 / 2, hourlyRate: 30, days }), 2026, 1);
    expect(half({}).normMinutes).toBe(80 * 60);
    const twelve = half(feb(12)); // 96 h
    expect(twelve.extraTimeMinutes).toBe(16 * 60);
    expect(twelve.overtimeMinutes).toBe(0);
    expect(twelve.earnings).toBe(96 * 30);
    const twentyOne = half(feb(21)); // 168 h
    expect(twentyOne.extraTimeMinutes).toBe(80 * 60);
    expect(twentyOne.overtimeMinutes).toBe(8 * 60);
    // Pełny etat bez zmian: brak godzin ponadwymiarowych.
    expect(monthSummary(data({ days: feb(21) }), 2026, 1).extraTimeMinutes).toBe(0);
  });

  it("umowna granica nadgodzin (art. 151 § 5 KP)", () => {
    // Pół etatu, nadgodziny ponad 3/4 etatu: luty 2026 = 80 h normy, granica 120 h; 17 dni = 136 h.
    const days = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`2026-02-${String(i + 1).padStart(2, "0")}`, { type: "d" }]));
    const s = monthSummary(data({ fte: 1 / 2, overtimeFrom: 3 / 4, hourlyRate: 30, days }), 2026, 1);
    expect(s.extraTimeMinutes).toBe(40 * 60);
    expect(s.overtimeMinutes).toBe(16 * 60);
    expect(s.earnings).toBe(136 * 30 + 16 * 30);
    // Granica poniżej etatu nie ma sensu — liczy się etat.
    expect(monthSummary(data({ fte: 3 / 4, overtimeFrom: 1 / 2, days }), 2026, 1).overtimeMinutes).toBe(16 * 60);
    expect(migrate({ overtimeFrom: 2 }).overtimeFrom).toBe(1);
  });

  it("odrzuca wymiar spoza (0, 1]", () => {
    expect(migrate({ fte: 0 }).fte).toBe(1);
    expect(migrate({ fte: 1.5 }).fte).toBe(1);
    expect(migrate({ fte: 0.75 }).fte).toBe(0.75);
  });
});

describe("godziny z dnia zmiany", () => {
  it("dzień z zapamiętanymi godzinami liczy się z nich, nie z bieżących godzin rodzaju", () => {
    const later = { ...day, start: "07:00", end: "17:00" }; // dziś 10 h
    const s = monthSummary(data({ types: [later], days: {
      "2026-10-01": { type: "d", hours: { start: "06:00", end: "14:00", breakMin: 0 } },
      "2026-10-02": { type: "d" },
    } }), 2026, 9);
    expect(s.minutes).toBe(8 * 60 + 10 * 60);
    expect(s.dailyOvertimeMinutes).toBe(2 * 60);
    expect(s.byType[0].type.start).toBe("07:00");
  });

  it("migracja odrzuca zepsute godziny dnia", () => {
    const m = migrate({ days: {
      "2026-10-01": { type: "d", hours: { start: "6", end: "14:00", breakMin: 0 } },
      "2026-10-02": { type: "d", hours: { start: "06:00", end: "14:00", breakMin: 30 } },
    } });
    expect(m.days["2026-10-01"].hours).toBeUndefined();
    expect(m.days["2026-10-02"].hours).toEqual({ start: "06:00", end: "14:00", breakMin: 30 });
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

  it("eksport dwóch grafików nie miesza UID ani listy wysłanych dni", () => {
    expect(icsScope("main")).toEqual({ exportedKey: "kaczy:shifts.icsExported", uidPrefix: "shift-" });
    expect(icsScope("b1")).toEqual({ exportedKey: "kaczy:shifts.icsExported.b1", uidPrefix: "shift-b1-" });
    const d = data({ types: [day], days: { "2026-10-24": { type: day.id } } });
    const main = buildShiftsIcs(d, ["2026-10-24"], { now: 0 });
    const other = buildShiftsIcs(d, ["2026-10-24"], { now: 0, uidPrefix: icsScope("b1").uidPrefix });
    expect(main).toContain("UID:shift-2026-10-24@notatnik");
    expect(other).toContain("UID:shift-b1-2026-10-24@notatnik");
    expect(other).not.toContain("UID:shift-2026-10-24@notatnik");
  });

  it("zmiana zakończona przed chwilą zostaje do wyjścia z okna łaski (nadgodziny)", () => {
    const d = data({ types: [day], days: { "2026-10-22": { type: day.id } } });
    // Dzień 06:00–14:00 (zob. DEFAULT_SHIFT_TYPES); 15:00 — godzinę po końcu.
    expect(recentlyEndedShift(d, new Date(2026, 9, 22, 15, 0))?.dayKey).toBe("2026-10-22");
    expect(recentlyEndedShift(d, new Date(2026, 9, 22, 13, 0))).toBeNull();
    expect(recentlyEndedShift(d, new Date(2026, 9, 22, 19, 0))).toBeNull();
  });

  it("komórka, okno dnia i rachunek pokazują ten sam czas nocy zmiany czasu", () => {
    expect(entryMinutesOn(night, undefined, "2026-10-24")).toBe(540);
    expect(entryMinutesOn(night, { extraMin: 30 }, "2026-10-24")).toBe(570);
    expect(entryMinutesOn(night, undefined, "2026-10-09")).toBe(480);
  });
});

describe("akcje grafiku", () => {
  it("inny rodzaj zmiany zachowuje notatkę i odchylenie (plan 1.4)", () => {
    restoreShifts(data({ types: [day, night], days: { "2026-10-01": { type: "d", note: "zastępstwo", extraMin: 120 } } }));
    setDayShift("2026-10-01", "n");
    expect(shiftStore.get().days["2026-10-01"]).toEqual({ type: "n", note: "zastępstwo", extraMin: 120 });
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

  it("alarm rodzaju zmiany ma pierwszeństwo, 0 wyłącza alarm", () => {
    const key = "2026-10-09";
    const withAlarm = (alarmMin: number) => ({ ...d, types: d.types.map((t) => (t.id === "n" ? { ...t, alarmMin } : t)) });
    expect(buildShiftsIcs(withAlarm(120), [key])).toContain("TRIGGER:-PT120M");
    const none = buildShiftsIcs({ ...d, types: d.types.map((t) => ({ ...t, alarmMin: 0 })) }, [key]);
    expect(none).not.toContain("VALARM");
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
