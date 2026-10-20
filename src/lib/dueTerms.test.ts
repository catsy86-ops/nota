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

  it("koniec dnia to 23:59:59.999 czasu lokalnego", () => {
    const d = new Date(endOfDayOffset(now));
    expect([d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()]).toEqual([23, 59, 59, 999]);
  });
});
