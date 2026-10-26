import { describe, it, expect } from "vitest";
import { doneTarget, endOfDay, getNextReminderTime, nextInSeries, nextOccurrence, seriesDay, snoozeTarget } from "./reminderRepeat";

describe("getNextReminderTime", () => {
  const base = new Date(2026, 0, 15, 9, 30).getTime(); // 15 Jan 2026, 09:30

  it("advances by one day for 'daily', keeping the time", () => {
    const next = new Date(getNextReminderTime(base, "daily"));
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it("advances by seven days for 'weekly'", () => {
    const next = new Date(getNextReminderTime(base, "weekly"));
    expect(next.getDate()).toBe(22);
    expect(next.getMonth()).toBe(0);
  });

  it("advances by one month for 'monthly'", () => {
    const next = new Date(getNextReminderTime(base, "monthly"));
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(15);
  });

  it("returns the same timestamp for 'none'", () => {
    expect(getNextReminderTime(base, "none")).toBe(base);
  });

  it("rolls over month/year boundaries correctly", () => {
    const dec31 = new Date(2026, 11, 31, 8, 0).getTime();
    const next = new Date(getNextReminderTime(dec31, "daily"));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(1);
  });
});

describe("seria miesięczna na końcu miesiąca", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 30).getTime();
  const key = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  it("31 stycznia → 28 lutego (zwykły rok) i 29 lutego (przestępny)", () => {
    expect(key(getNextReminderTime(at(2026, 1, 31), "monthly"))).toBe("2026-2-28");
    expect(key(getNextReminderTime(at(2028, 1, 31), "monthly"))).toBe("2028-2-29");
  });

  it("z dniem serii wraca z 28 lutego na 31 marca, 30. na 30.", () => {
    expect(key(getNextReminderTime(at(2026, 2, 28), "monthly", 31))).toBe("2026-3-31");
    expect(key(getNextReminderTime(at(2026, 2, 28), "monthly", 30))).toBe("2026-3-30");
    expect(key(getNextReminderTime(at(2026, 3, 31), "monthly", 31))).toBe("2026-4-30");
  });

  it("zachowuje godzinę i przechodzi przez koniec roku", () => {
    const next = new Date(getNextReminderTime(at(2026, 12, 31), "monthly"));
    expect(key(next.getTime())).toBe("2027-1-31");
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it("seriesDay: pole z notatki, a bez niego dzień zapisanego terminu", () => {
    expect(seriesDay({ reminder: at(2026, 2, 28), reminderDay: 31 })).toBe(31);
    expect(seriesDay({ reminder: at(2026, 1, 31) })).toBe(31);
    expect(seriesDay({ reminder: null })).toBeUndefined();
  });
});

describe("koniec serii", () => {
  it("nextInSeries zwraca null po dniu końca, a w ostatnim dniu jeszcze termin", () => {
    const start = new Date(2026, 9, 5, 9, 0).getTime();
    const until = endOfDay(new Date(2026, 9, 7));
    expect(nextInSeries(start, "daily", undefined, until)).toBe(new Date(2026, 9, 6, 9, 0).getTime());
    expect(nextInSeries(new Date(2026, 9, 6, 9, 0).getTime(), "daily", undefined, until)).toBe(new Date(2026, 9, 7, 9, 0).getTime());
    expect(nextInSeries(new Date(2026, 9, 7, 9, 0).getTime(), "daily", undefined, until)).toBeNull();
    expect(nextInSeries(start, "weekly")).toBe(new Date(2026, 9, 12, 9, 0).getTime());
  });
});

describe("nextOccurrence — odłożone wystąpienie nie przesuwa serii", () => {
  const at = (d: number, h = 9, min = 0) => new Date(2026, 9, d, h, min).getTime();

  it("bez odłożenia liczy od zapisanego terminu", () => {
    expect(nextOccurrence({ reminder: at(19), reminderRepeat: "daily" }, at(19))).toBe(at(20));
  });

  it("z odłożeniem kolejny termin to następny dzień serii, nie odłożona chwila", () => {
    const note = { reminder: at(19, 9, 10), reminderBase: at(19), reminderRepeat: "daily" as const };
    expect(nextOccurrence(note, at(19, 9, 10))).toBe(at(20));
  });

  it("odłożenie w serii tygodniowej zachowuje dzień tygodnia i godzinę serii", () => {
    const note = { reminder: at(20, 17, 0), reminderBase: at(19), reminderRepeat: "weekly" as const };
    expect(nextOccurrence(note, at(20, 17, 0))).toBe(at(26));
  });

  it("seria jednorazowa nie ma następnego wystąpienia", () => {
    expect(nextOccurrence({ reminder: at(19), reminderRepeat: "none" }, at(19))).toBeNull();
  });
});

describe("doneTarget — „Gotowe” przechodzi do następnego wystąpienia", () => {
  const at = (d: number, h = 9, min = 0) => new Date(2026, 9, d, h, min).getTime();

  it("seria jednorazowa kończy przypomnienie", () => {
    expect(doneTarget({ reminder: at(19), reminderRepeat: "none" }, at(19, 9, 5))).toBeNull();
  });

  it("zwykła seria: następny dzień o tej samej godzinie", () => {
    expect(doneTarget({ reminder: at(19), reminderRepeat: "daily" }, at(19, 9, 5))).toBe(at(20));
  });

  it("odłożone wystąpienie: następne to kolejny dzień serii, nie odłożona chwila", () => {
    const note = { reminder: at(19, 9, 10), reminderBase: at(19), reminderRepeat: "daily" as const };
    expect(doneTarget(note, at(19, 9, 12))).toBe(at(20));
  });

  it("zaległa seria: pomija wystąpienia, które już minęły", () => {
    expect(doneTarget({ reminder: at(19), reminderRepeat: "daily" }, at(22, 10))).toBe(at(23));
  });

  it("koniec serii: brak następnego terminu", () => {
    expect(doneTarget({ reminder: at(19), reminderRepeat: "daily", reminderRepeatUntil: at(19, 23, 59) }, at(19, 9, 5))).toBeNull();
  });
});

describe("snoozeTarget — odłożenie jednego wystąpienia", () => {
  const at = (d: number, h = 9, min = 0) => new Date(2026, 9, d, h, min).getTime();

  it("seria jednorazowa: zwykły nowy termin, bez bazy", () => {
    expect(snoozeTarget({ reminder: at(19), reminderRepeat: "none" }, at(19, 9, 10), at(19, 9))).toEqual({
      reminder: at(19, 9, 10),
      reminderBase: undefined,
    });
  });

  it("seria: odłożona chwila przed kolejnym terminem zapisuje termin serii jako bazę", () => {
    const note = { reminder: at(19), reminderRepeat: "daily" as const };
    expect(snoozeTarget(note, at(19, 9, 10), at(19, 9))).toEqual({ reminder: at(19, 9, 10), reminderBase: at(19) });
  });

  it("odłożenie po kolejnym terminie serii zastępuje go zwykłym terminem serii", () => {
    const note = { reminder: at(19), reminderRepeat: "daily" as const };
    // „Jutro o 9:00” wypada na tym samym dniu co kolejne wystąpienie 20.10 — nie może wyprzedzić serii.
    expect(snoozeTarget(note, at(20, 9), at(19, 9))).toEqual({ reminder: at(20), reminderBase: undefined });
  });

  it("zaległe wystąpienia: odkładamy ostatnie, które minęło, nie stary termin", () => {
    // Aplikacja była zamknięta 3 dni; teraz 22.10 10:00. Odkładamy wystąpienie z 22.10.
    const note = { reminder: at(19), reminderRepeat: "daily" as const };
    const now = at(22, 10);
    const t = snoozeTarget(note, now + 10 * 60_000, now);
    expect(t.reminderBase).toBe(at(22));
    expect(t.reminder).toBe(now + 10 * 60_000);
  });

  it("seria, która się skończyła, zostawia odłożenie jako ostatni termin", () => {
    const note = { reminder: at(19), reminderRepeat: "daily" as const, reminderRepeatUntil: at(19, 23, 59) };
    expect(snoozeTarget(note, at(19, 9, 10), at(19, 9))).toEqual({ reminder: at(19, 9, 10), reminderBase: at(19) });
  });
});

describe("seriesDay po odłożeniu (T 1.4)", () => {
  it("bez reminderDay bierze dzień z reminderBase, nie z odłożonego terminu", () => {
    // Seria z 31. dnia odłożona na 2. dnia miesiąca: dzień serii to 31, nie 2.
    const d = (m: number, day: number) => new Date(2026, m - 1, day, 9, 30).getTime();
    expect(seriesDay({ reminder: d(3, 2), reminderBase: d(2, 28) })).toBe(28);
  });
});
