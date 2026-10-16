import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { dailyReportNudge, reportDueMinute, REPORT_NUDGE_FALLBACK, weekKeyOf, weeklyReportNudge } from "./reportNudge";
import { parseReportParam, reportParam } from "./reportLink";
import type { JournalEntry } from "./yStudy";

const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const e = (id: string, when: Date, site = "Lipowa 5"): JournalEntry =>
  ({ id, at: when.getTime(), kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [] });
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

const work = EMPTY_SHIFT_DATA.types.find((t) => t.id === "b")!;
const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, days: { "2026-10-14": { type: "b" }, "2026-10-15": { type: "u" } } };

describe("reportDueMinute", () => {
  it("koniec dzisiejszej zmiany z Grafiku", () => {
    expect(reportDueMinute(shifts, "2026-10-14")).toBe(toMin(work.end));
  });

  it("nieobecność albo brak zmiany — godzina stała", () => {
    expect(reportDueMinute(shifts, "2026-10-15")).toBe(toMin(REPORT_NUDGE_FALLBACK));
    expect(reportDueMinute(shifts, "2026-10-16")).toBe(toMin(REPORT_NUDGE_FALLBACK));
    expect(reportDueMinute(null, "2026-10-14")).toBe(toMin(REPORT_NUDGE_FALLBACK));
  });

  it("zmiana przez północ (koniec przed początkiem) — godzina stała", () => {
    const night: ShiftData = {
      ...EMPTY_SHIFT_DATA,
      types: [...EMPTY_SHIFT_DATA.types, { ...work, id: "n", name: "Noc", start: "22:00", end: "06:00" }],
      days: { "2026-10-14": { type: "n" } },
    };
    expect(reportDueMinute(night, "2026-10-14")).toBe(toMin(REPORT_NUDGE_FALLBACK));
  });
});

describe("dailyReportNudge", () => {
  const journal = [e("a", at(14, 8)), e("b", at(14, 11), "Polna 2"), e("c", at(13, 9))];
  const end = toMin(work.end);
  const afterShift = at(14, Math.floor(end / 60), (end % 60) + 1);
  const beforeShift = at(14, Math.floor(end / 60) - 1, 0);

  it("po końcu zmiany, gdy dziś są wpisy: liczy wpisy i budowy z dzisiaj", () => {
    expect(dailyReportNudge(journal, shifts, afterShift, null)).toEqual({ dayKey: "2026-10-14", entries: 2, sites: 2 });
  });

  it("przed końcem zmiany — jeszcze nie", () => {
    expect(dailyReportNudge(journal, shifts, beforeShift, null)).toBeNull();
  });

  it("raz dziennie: po przypomnieniu tego dnia — nic", () => {
    expect(dailyReportNudge(journal, shifts, afterShift, "2026-10-14")).toBeNull();
    expect(dailyReportNudge(journal, shifts, afterShift, "2026-10-13")).not.toBeNull();
  });

  it("bez dzisiejszych wpisów — nic", () => {
    expect(dailyReportNudge([e("c", at(13, 9))], shifts, afterShift, null)).toBeNull();
  });
});

describe("weeklyReportNudge", () => {
  // 16.10.2026 to piątek, 17 — sobota, 19 — poniedziałek.
  const week = [e("a", at(12, 9)), e("b", at(14, 9), "Polna 2"), e("stary", at(5, 9))];
  const fridayAfter = at(16, Math.floor(toMin(REPORT_NUDGE_FALLBACK) / 60) + 1);

  it("piątek po końcu dnia pracy: wpisy z 7 dni i budowy, klucz tygodnia = poniedziałek", () => {
    expect(weeklyReportNudge(week, null, fridayAfter, null)).toEqual({ weekKey: "2026-10-12", dayKey: "2026-10-16", entries: 2, sites: 2 });
  });

  it("piątek przed końcem pracy, inny dzień tygodnia, już przypomniane albo pusty tydzień — nic", () => {
    expect(weeklyReportNudge(week, null, at(16, 9), null)).toBeNull();
    expect(weeklyReportNudge(week, null, at(14, 20), null)).toBeNull();
    expect(weeklyReportNudge(week, null, fridayAfter, "2026-10-12")).toBeNull();
    expect(weeklyReportNudge([e("stary", at(5, 9))], null, fridayAfter, null)).toBeNull();
  });

  it("w weekend, jeśli w piątek nie było okazji (od rana)", () => {
    expect(weeklyReportNudge(week, null, at(17, 8), null)?.weekKey).toBe("2026-10-12");
    expect(weekKeyOf(at(18, 8))).toBe("2026-10-12");
    expect(weekKeyOf(at(19, 8))).toBe("2026-10-19");
  });
});

describe("parametr adresu raportu", () => {
  it("w obie strony", () => {
    for (const req of [
      { range: "day" as const, allSites: false },
      { range: "day" as const, allSites: true },
      { range: "week" as const, allSites: false },
      { range: "week" as const, allSites: true },
    ]) expect(parseReportParam(reportParam(req))).toEqual(req);
    expect(reportParam({ range: "week", allSites: true })).toBe("tydzien-wszystkie");
    expect(parseReportParam("cokolwiek")).toEqual({ range: "day", allSites: false });
  });
});
