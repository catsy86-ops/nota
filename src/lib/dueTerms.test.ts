import { describe, expect, it } from "vitest";
import { endOfDayOffset, termStatus } from "./dueTerms";

const now = new Date(2026, 9, 19, 12, 0, 0, 0).getTime();
const HOUR = 3600_000;

describe("termStatus", () => {
  it("termin przed teraz to zaległy", () => {
    expect(termStatus(now - 1, now)).toBe("overdue");
    expect(termStatus(now - 5 * HOUR, now)).toBe("overdue");
  });

  it("później tego samego dnia to dziś, także tuż przed północą", () => {
    expect(termStatus(now + HOUR, now)).toBe("today");
    expect(termStatus(endOfDayOffset(now), now)).toBe("today");
  });

  it("od północy do 7 dni to najbliższe, potem później", () => {
    expect(termStatus(endOfDayOffset(now) + 1, now)).toBe("week");
    expect(termStatus(endOfDayOffset(now, 7), now)).toBe("week");
    expect(termStatus(endOfDayOffset(now, 7) + 1, now)).toBe("later");
  });

  it("cały dzień: rano wpisany termin jest „Dziś” do północy, zaległy dopiero od jutra (D-1)", () => {
    const nineAm = new Date(2026, 9, 19, 9, 0, 0, 0).getTime();
    const midnightPast = new Date(2026, 9, 19, 0, 0, 0, 0).getTime();
    expect(termStatus(nineAm, now)).toBe("overdue");
    expect(termStatus(nineAm, now, true)).toBe("today");
    expect(termStatus(midnightPast, now, true)).toBe("today");
    // Wczoraj „cały dzień” jest już zaległy.
    const yesterday = new Date(2026, 9, 18, 9, 0, 0, 0).getTime();
    expect(termStatus(yesterday, now, true)).toBe("overdue");
    // Bez flagi bez zmian: zwykły termin o 9:00 jest zaległy o 12:00.
    expect(termStatus(nineAm, now, false)).toBe("overdue");
  });

  it("koniec dnia to 23:59:59.999 czasu lokalnego", () => {
    const d = new Date(endOfDayOffset(now));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
});
