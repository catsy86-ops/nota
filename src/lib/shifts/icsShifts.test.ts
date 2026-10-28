import { describe, expect, it } from "vitest";
import { MAX_OCCURRENCES, occurrenceKeys, planShiftsFromIcs, RECUR_HORIZON_DAYS } from "./icsShifts";

const ev = (start: string, summary = "Praca") => [
  "BEGIN:VEVENT", `DTSTART:${start}`, `SUMMARY:${summary}`, "END:VEVENT",
].join("\r\n");
const ics = (...events: string[]) => ["BEGIN:VCALENDAR", ...events, "END:VCALENDAR"].join("\r\n");
const NOW = new Date(2026, 9, 28, 12).getTime();

describe("planShiftsFromIcs (E3)", () => {
  it("każdy dzień z pliku dostaje wybrany rodzaj, także przeszły", () => {
    const plan = planShiftsFromIcs(ics(ev("20261005T070000"), ev("20261006T070000")), { days: {} }, "e", NOW);
    expect(plan.changes).toEqual({ "2026-10-05": { type: "e" }, "2026-10-06": { type: "e" } });
    expect(plan.imported).toBe(2);
  });

  it("nie nadpisuje dni, które już mają wpis, ani drugiego zdarzenia tego samego dnia", () => {
    const plan = planShiftsFromIcs(ics(ev("20261005T070000"), ev("20261005T150000"), ev("20261006T070000")), { days: { "2026-10-06": { type: "u" } } }, "b", NOW);
    expect(plan.changes).toEqual({ "2026-10-05": { type: "b" } });
    expect(plan.skippedFilled).toBe(2);
  });

  it("liczy cykliczne zdarzenia i pomija wpisy bez daty", () => {
    const repeat = ["BEGIN:VEVENT", "DTSTART:20261001T070000", "RRULE:FREQ=WEEKLY;COUNT=1", "SUMMARY:Praca", "END:VEVENT"].join("\r\n");
    const bad = ["BEGIN:VEVENT", "DTSTART:xyz", "SUMMARY:?", "END:VEVENT"].join("\r\n");
    const plan = planShiftsFromIcs(ics(repeat, bad), { days: {} }, "e", NOW);
    expect(plan.repeating).toBe(1);
    expect(plan.unreadable).toBe(1);
    expect(plan.imported).toBe(1);
  });
});

describe("rozwijanie RRULE (E3)", () => {
  const at = (ms: number, rrule?: string) => ({ reminder: ms, rrule });
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 7).getTime();
  const TODAY = "2026-10-28";

  it("DAILY z COUNT daje tyle wystąpień, ile COUNT", () => {
    expect(occurrenceKeys(at(d(2026, 10, 1), "FREQ=DAILY;COUNT=3"), TODAY)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("WEEKLY z INTERVAL=2 idzie co dwa tygodnie tym samym dniem tygodnia", () => {
    expect(occurrenceKeys(at(d(2026, 10, 1), "FREQ=WEEKLY;INTERVAL=2;COUNT=3"), TODAY)).toEqual(["2026-10-01", "2026-10-15", "2026-10-29"]);
  });

  it("UNTIL odcina wystąpienia po dacie (bez względu na godzinę)", () => {
    expect(occurrenceKeys(at(d(2026, 10, 1), "FREQ=DAILY;UNTIL=20261003T235959Z"), TODAY)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
  });

  it("bez UNTIL i COUNT rozwija najwyżej rok od dziś", () => {
    const keys = occurrenceKeys(at(d(2026, 10, 1), "FREQ=DAILY"), TODAY);
    // 366 dni od 2026-10-28 (horyzont liczy dni, nie lata).
    expect(keys.at(-1)).toBe("2027-10-29");
    expect(keys.length).toBeLessThanOrEqual(MAX_OCCURRENCES);
    expect(RECUR_HORIZON_DAYS).toBe(366);
  });

  it("MONTHLY pomija miesiące bez tego dnia (31 lutego nie istnieje)", () => {
    expect(occurrenceKeys(at(d(2026, 1, 31), "FREQ=MONTHLY;COUNT=3"), TODAY)).toEqual(["2026-01-31", "2026-03-31", "2026-05-31"]);
  });

  it("zdarzenie bez RRULE to jeden dzień", () => {
    expect(occurrenceKeys(at(d(2026, 10, 5)), TODAY)).toEqual(["2026-10-05"]);
  });
});

describe("planShiftsFromIcs: podgląd dzień po dniu (E3)", () => {
  it("pokazuje każdy dzień z nazwą rodzaju i oznacza zajęte", () => {
    const e = (start: string) => ["BEGIN:VEVENT", `DTSTART:${start}`, "SUMMARY:Praca", "END:VEVENT"].join("\r\n");
    const text = ics(e("20261007T070000"), e("20261005T070000"));
    const types = [{ id: "e", name: "Dniówka", short: "8", color: "#000", start: "08:00", end: "16:00", breakMin: 0, kind: "work" as const }];
    const plan = planShiftsFromIcs(text, { days: { "2026-10-07": { type: "u" } }, types }, "e", NOW);
    expect(plan.preview.map((p) => [p.key, p.typeName, p.status])).toEqual([
      ["2026-10-05", "Dniówka", "import"],
      ["2026-10-07", "Dniówka", "filled"],
    ]);
    expect(plan.imported).toBe(1);
  });
});
