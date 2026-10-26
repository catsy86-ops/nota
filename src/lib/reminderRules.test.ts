import { describe, it, expect } from "vitest";
import { getNextReminderTime, nextOccurrence, fallbackRepeat, ruleOf, changeRepeatKind, toggleWeekday, clampEvery, type RepeatRule } from "./reminderRepeat";
import { mergeSpec, readRule, readSpec } from "./reminderSpec";

// Rodzaje z 3.1. Daty lokalne: 2026-10-26 to poniedziałek.
const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const day = (t: number) => new Date(t).getDate();

describe("nowe rodzaje powtarzania (T-1, 3.1)", () => {
  it("dni robocze omijają weekend: z piątku od razu w poniedziałek", () => {
    const next = getNextReminderTime(at(2026, 10, 30), { kind: "workdays" }, undefined, 9 * 60);
    expect(new Date(next).getDay()).toBe(1);
    expect(day(next)).toBe(2);
  });

  it("co 2 tygodnie: +14 dni, ta sama godzina", () => {
    const next = getNextReminderTime(at(2026, 10, 26), { kind: "biweekly" }, undefined, 9 * 60);
    expect(day(next)).toBe(9);
    expect(new Date(next).getHours()).toBe(9);
  });

  it("co rok: 29 lutego w roku bez takiego dnia → 28 lutego, a kotwica dnia wraca w roku przestępnym", () => {
    const next = getNextReminderTime(at(2028, 2, 29), { kind: "yearly" }, 29, 9 * 60);
    expect(new Date(next).getFullYear()).toBe(2029);
    expect(new Date(next).getMonth()).toBe(1);
    expect(day(next)).toBe(28);
  });

  it("wybrane dni tygodnia: pn i śr, z poniedziałku idzie do środy, ze środy do poniedziałku", () => {
    const rule: RepeatRule = { kind: "weekdays", days: [1, 3] };
    const toWed = getNextReminderTime(at(2026, 10, 26), rule, undefined, 9 * 60);
    expect(new Date(toWed).getDay()).toBe(3);
    const toMon = getNextReminderTime(at(2026, 10, 28), rule, undefined, 9 * 60);
    expect(new Date(toMon).getDay()).toBe(1);
  });

  it("co N dni: 3 dni z poniedziałku to czwartek", () => {
    const next = getNextReminderTime(at(2026, 10, 26), { kind: "every", every: 3 }, undefined, 9 * 60);
    expect(day(next)).toBe(29);
  });

  it("nextOccurrence bierze regułę przed zapasowym rodzajem", () => {
    const note = { reminder: at(2026, 10, 30), reminderRepeat: "daily" as const, reminderRule: { kind: "workdays" as const }, reminderTime: 9 * 60 };
    const next = nextOccurrence(note, note.reminder);
    expect(new Date(next as number).getDay()).toBe(1);
  });

  it("bez reguły działa zwykły rodzaj ze starego pola", () => {
    expect(ruleOf({ reminderRepeat: "weekly" })).toEqual({ kind: "weekly" });
    expect(ruleOf({})).toEqual({ kind: "none" });
  });

  it("zapasowy rodzaj dla starszych wersji jest najbliższym znanym", () => {
    expect(fallbackRepeat({ kind: "workdays" })).toBe("daily");
    expect(fallbackRepeat({ kind: "biweekly" })).toBe("weekly");
    expect(fallbackRepeat({ kind: "yearly" })).toBe("monthly");
    expect(fallbackRepeat({ kind: "every", every: 5 })).toBe("daily");
  });
});

describe("zapis i odczyt reguły (reminderSpec)", () => {
  it("readRule odrzuca zepsute parametry, a dobre zostawia", () => {
    expect(readRule({ kind: "nieznany" })).toBeUndefined();
    expect(readRule({ kind: "weekdays", days: [] })).toBeUndefined();
    expect(readRule({ kind: "weekdays", days: [9, 12] })).toBeUndefined();
    expect(readRule({ kind: "every", every: 0 })).toBeUndefined();
    expect(readRule({ kind: "every", every: 1.5 })).toBeUndefined();
    expect(readRule({ kind: "weekdays", days: [3, 1, 1] })).toEqual({ kind: "weekdays", days: [1, 3] });
    expect(readRule({ kind: "workdays" })).toEqual({ kind: "workdays" });
  });

  it("ustawienie reguły ustawia zapasowy rodzaj; ręczny wybór starego rodzaju zdejmuje regułę", () => {
    const withRule = mergeSpec({ reminder: 1 }, { reminderRule: { kind: "workdays" } });
    expect(withRule).toMatchObject({ reminderRule: { kind: "workdays" }, reminderRepeat: "daily" });
    const back = mergeSpec(withRule, { reminderRepeat: "weekly" });
    expect(back.reminderRule).toBeUndefined();
    expect(back.reminderRepeat).toBe("weekly");
  });

  it("readSpec czyta regułę z dokumentu i pomija ją, gdy jest uszkodzona", () => {
    expect(readSpec({ reminder: 1, reminderRepeat: "daily", reminderRule: { kind: "workdays" } })).toMatchObject({ reminderRule: { kind: "workdays" } });
    expect(readSpec({ reminder: 1, reminderRepeat: "daily", reminderRule: { kind: "every", every: -2 } })).toEqual({ reminder: 1, reminderRepeat: "daily" });
  });
});

describe("wybór powtarzania w pickerze (wspólne helpery)", () => {
  it("zmiana rodzaju: pusty wybór dni dostaje dzień terminu, „co N dni” domyślnie co 2", () => {
    expect(changeRepeatKind("weekdays", { kind: "none" }, new Date(2026, 9, 28))).toEqual({ kind: "weekdays", days: [3] });
    expect(changeRepeatKind("every", { kind: "none" })).toEqual({ kind: "every", every: 2 });
    expect(changeRepeatKind("daily", { kind: "every", every: 5 })).toEqual({ kind: "daily" });
  });

  it("nie da się odznaczyć ostatniego dnia i dni są posortowane", () => {
    expect(toggleWeekday([3], 3)).toEqual([3]);
    expect(toggleWeekday([3], 1)).toEqual([1, 3]);
    expect(toggleWeekday([1, 3], 1)).toEqual([3]);
  });

  it("liczba dni mieści się w 1–366, a śmieci dają 1", () => {
    expect(clampEvery("0")).toBe(1);
    expect(clampEvery("999")).toBe(366);
    expect(clampEvery("abc")).toBe(1);
    expect(clampEvery("7")).toBe(7);
  });
});
