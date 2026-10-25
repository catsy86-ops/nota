import { describe, expect, it } from "vitest";
import { parseIcs } from "./icsImport";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const ics = (...events: string[]) => ["BEGIN:VCALENDAR", ...events, "END:VCALENDAR"].join("\r\n");
const event = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("parseIcs (import przypomnień, QoL)", () => {
  it("lokalny DTSTART staje się terminem o tej samej godzinie ściennej", () => {
    const r = parseIcs(ics(event("DTSTART:20261015T093000", "SUMMARY:Dentysta")), NOW);
    expect(r.events).toEqual([{ title: "Dentysta", content: "", reminder: new Date(2026, 9, 15, 9, 30).getTime(), repeat: "none", allDay: false }]);
  });

  it("UTC (Z) przelicza się na czas lokalny", () => {
    const r = parseIcs(ics(event("DTSTART:20261015T080000Z", "SUMMARY:Spotkanie")), NOW);
    expect(r.events[0].reminder).toBe(Date.UTC(2026, 9, 15, 8, 0, 0));
  });

  it("dzień całodniowy (VALUE=DATE) to 9:00 i allDay", () => {
    const r = parseIcs(ics(event("DTSTART;VALUE=DATE:20261020", "SUMMARY:Rachunek")), NOW);
    expect(r.events[0]).toMatchObject({ allDay: true, reminder: new Date(2026, 9, 20, 9, 0).getTime() });
  });

  it("RRULE FREQ=WEEKLY daje powtarzanie tygodniowe; inne częstotliwości — brak powtarzania", () => {
    const r = parseIcs(ics(event("DTSTART:20261020T100000", "SUMMARY:Sprzątanie", "RRULE:FREQ=WEEKLY;BYDAY=TU"), event("DTSTART:20261020T110000", "SUMMARY:Rok", "RRULE:FREQ=YEARLY")), NOW);
    expect(r.events.map((e) => e.repeat)).toEqual(["weekly", "none"]);
  });

  it("terminy w przeszłości i bez DTSTART są pomijane", () => {
    const r = parseIcs(ics(event("DTSTART:20261001T090000", "SUMMARY:Stare"), event("SUMMARY:Bez daty")), NOW);
    expect(r.events).toEqual([]);
    expect(r.skipped).toBe(1);
  });

  it("zawinięte linie i ucieczki tekstu są odczytywane", () => {
    const r = parseIcs(ics(event("DTSTART:20261015T090000", "SUMMARY:Materiał\\, cement", "  i piasek", "DESCRIPTION:Linia 1\\nLinia 2")), NOW);
    expect(r.events[0].title).toBe("Materiał, cement i piasek");
    expect(r.events[0].content).toBe("Linia 1\nLinia 2");
  });

  it("bez tytułu dostaje nazwę zastępczą", () => {
    const r = parseIcs(ics(event("DTSTART:20261015T090000")), NOW);
    expect(r.events[0].title).toBe("Przypomnienie z kalendarza");
  });
});
