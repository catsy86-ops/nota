import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { buildJournalReport, dayKeyOf, reportBody } from "./report";
import { cleanSiteHours, dayHours, evenShare, parseHours, siteMinutesOn } from "./siteHours";
import { siteKey } from "./sites";
import type { JournalEntry } from "./yStudy";

const at = (day: number, h: number) => new Date(2026, 9, day, h).getTime();
const e = (id: string, when: number, site: string): JournalEntry =>
  ({ id, at: when, kind: "ok", topic: null, text: "Montaż", site, checked: [], images: [] });
const A = siteKey("Lipowa 5");
const B = siteKey("Polna 2");
const journal = [e("1", at(14, 8), "Lipowa 5"), e("2", at(14, 13), "Polna 2"), e("3", at(15, 9), "Lipowa 5")];
// „b” — dniówka z EMPTY_SHIFT_DATA (10 h).
const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, days: { "2026-10-14": { type: "b" }, "2026-10-15": { type: "b" } } };
const WORK = 10 * 60;

describe("parseHours", () => {
  it("minuty powyżej 59 są błędem, nie dodatkiem do godzin", () => {
    expect(parseHours("6:70")).toBeNull();
    expect(parseHours("6:55")).toBe(360 + 55);
  });
  it("różne zapisy godzin", () => {
    expect(parseHours("6")).toBe(360);
    expect(parseHours("6,5")).toBe(390);
    expect(parseHours("6.25 h")).toBe(375);
    expect(parseHours("6:30")).toBe(390);
    expect(parseHours("6 h 30")).toBe(390);
    expect(parseHours("")).toBe(0);
    expect(parseHours("dużo")).toBeNull();
    expect(parseHours("25")).toBeNull();
  });
});

describe("cleanSiteHours", () => {
  it("jedna pozycja na dzień, bez zer i śmieci", () => {
    expect(cleanSiteHours([
      { id: "2026-10-15", minutes: 120 }, { id: "2026-10-14", minutes: 60.4 }, { id: "2026-10-14", minutes: 30 },
      { id: "zly", minutes: 10 }, { id: "2026-10-16", minutes: 0 }, { id: "2026-10-17", minutes: 2000 },
    ])).toEqual([{ id: "2026-10-14", minutes: 60 }, { id: "2026-10-15", minutes: 120 }]);
    expect(cleanSiteHours("x")).toBeUndefined();
  });
});

describe("dayHours", () => {
  it("jedna budowa w dniu — cały dzień", () => {
    const d = dayHours(journal, {}, WORK, "2026-10-15", dayKeyOf);
    expect(d.sites).toEqual([{ siteId: A, site: "Lipowa 5", minutes: WORK, set: false }]);
    expect(d.rest).toBe(0);
  });

  it("dwie budowy bez podziału — nierozdzielone", () => {
    const d = dayHours(journal, {}, WORK, "2026-10-14", dayKeyOf);
    expect(d.sites.map((s) => s.minutes)).toEqual([null, null]);
    expect(siteMinutesOn(d, A)).toBeNull();
    expect(siteMinutesOn(d, "inna")).toBe(0);
  });

  it("wpisana jedna — druga dostaje resztę", () => {
    const d = dayHours(journal, { [A]: { name: "Lipowa 5", hours: [{ id: "2026-10-14", minutes: 300 }] } }, WORK, "2026-10-14", dayKeyOf);
    expect(d.sites).toEqual([
      { siteId: A, site: "Lipowa 5", minutes: 300, set: true },
      { siteId: B, site: "Polna 2", minutes: 300, set: false },
    ]);
  });

  it("budowa z godzinami, ale bez wpisu tego dnia, też się liczy", () => {
    const d = dayHours(journal, { x: { name: "Hala", hours: [{ id: "2026-10-15", minutes: 120 }] } }, WORK, "2026-10-15", dayKeyOf);
    expect(d.sites.map((s) => [s.site, s.minutes])).toEqual([["Lipowa 5", 480], ["Hala", 120]]);
  });
});

describe("raport z podziałem godzin", () => {
  it("jedna budowa: jej godziny, a dzień nierozdzielony nie liczy się do sumy", () => {
    const r = buildJournalReport(journal, { siteId: A, from: "2026-10-14", to: "2026-10-15", shifts });
    expect(r.days[0].work?.site).toBeNull();
    expect(r.workMinutes).toBe(WORK);
    expect(reportBody(r)).toContain("godziny nierozdzielone");
  });

  it("jedna budowa z podziałem: suma z jej części", () => {
    const sites = { [A]: { name: "Lipowa 5", hours: [{ id: "2026-10-14", minutes: 300 }] } };
    const r = buildJournalReport(journal, { siteId: A, siteCard: { address: "", investor: "", ...sites[A] }, sites, from: "2026-10-14", to: "2026-10-15", shifts });
    expect(r.days.map((d) => d.work?.site)).toEqual([300, undefined]);
    expect(r.workMinutes).toBe(300 + WORK);
    expect(reportBody(r)).toContain("Praca: 5 h na tej budowie (z 10 h,");
    const b = buildJournalReport(journal, { siteId: B, sites, from: "2026-10-14", to: "2026-10-14", shifts });
    expect(b.workMinutes).toBe(300);
  });

  it("wszystkie budowy: cały dzień z podziałem w nawiasie", () => {
    const sites = { [A]: { name: "Lipowa 5", hours: [{ id: "2026-10-14", minutes: 300 }] } };
    const r = buildJournalReport(journal, { siteId: null, sites, from: "2026-10-14", to: "2026-10-14", shifts });
    expect(r.workMinutes).toBe(WORK);
    expect(reportBody(r)).toContain("(Lipowa 5: 5 h, Polna 2: 5 h)");
  });
});

describe("evenShare", () => {
  it("dzieli po równo i zaokrągla do 5 min; bez budów zero", () => {
    expect(evenShare(480, 3)).toBe(160);
    expect(evenShare(470, 3)).toBe(155);
    expect(evenShare(480, 0)).toBe(0);
  });
});
