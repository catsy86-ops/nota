import { describe, expect, it } from "vitest";
import { planShiftsFromIcs } from "./icsShifts";

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
    const repeat = ["BEGIN:VEVENT", "DTSTART:20261001T070000", "RRULE:FREQ=WEEKLY", "SUMMARY:Praca", "END:VEVENT"].join("\r\n");
    const bad = ["BEGIN:VEVENT", "DTSTART:xyz", "SUMMARY:?", "END:VEVENT"].join("\r\n");
    const plan = planShiftsFromIcs(ics(repeat, bad), { days: {} }, "e", NOW);
    expect(plan.repeating).toBe(1);
    expect(plan.unreadable).toBe(1);
    expect(plan.imported).toBe(1);
  });
});
