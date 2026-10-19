import { describe, expect, it } from "vitest";
import { mergeSpec, projectReminder, readSpec, specOf, type ReminderState } from "./reminderSpec";

const base: ReminderState = { reminder: 1000, reminderRepeat: "monthly", reminderDay: 31, reminderRepeatUntil: 9000 };

describe("mergeSpec", () => {
  it("zmiana terminu zostawia dzień serii i koniec — w jednej całości", () => {
    expect(mergeSpec(base, { reminder: 2000 })).toEqual({ reminder: 2000, reminderRepeat: "monthly", reminderDay: 31, reminderRepeatUntil: 9000 });
  });

  it("jawne undefined czyści pole, a brak klucza je zostawia", () => {
    expect(mergeSpec(base, { reminderRepeatUntil: undefined })).toEqual({ reminder: 1000, reminderRepeat: "monthly", reminderDay: 31 });
  });

  it("null czyści termin", () => {
    expect(mergeSpec(base, { reminder: null })).toEqual({ reminder: null, reminderRepeat: "monthly", reminderDay: 31, reminderRepeatUntil: 9000 });
  });

  it("specOf pomija undefined, żeby zapis był czysty", () => {
    expect(specOf({ reminder: 5, reminderRepeat: undefined })).toEqual({ reminder: 5 });
  });
});

describe("readSpec", () => {
  it("przepuszcza poprawną wartość", () => {
    expect(readSpec({ reminder: 1, reminderRepeat: "daily", reminderDay: 3, reminderRepeatUntil: 7 })).toEqual({ reminder: 1, reminderRepeat: "daily", reminderDay: 3, reminderRepeatUntil: 7 });
  });

  it("odrzuca śmieci i niepełne wartości", () => {
    expect(readSpec(null)).toBeNull();
    expect(readSpec({ reminder: "jutro" })).toBeNull();
    expect(readSpec({ reminder: 1, reminderRepeat: "co-rok" })).toEqual({ reminder: 1 });
    expect(readSpec({ reminder: 1, reminderDay: 40 })).toEqual({ reminder: 1 });
  });
});

describe("projectReminder", () => {
  it("bierze zapis całościowy, gdy istnieje", () => {
    expect(projectReminder({ reminder: 2 }, { reminder: 1, reminderRepeat: "daily" })).toEqual({ reminder: 2 });
  });

  it("bez reminderSpec czyta stare pola (notatki sprzed zmiany)", () => {
    expect(projectReminder(null, { reminder: 1, reminderRepeat: "weekly" })).toEqual({ reminder: 1, reminderRepeat: "weekly" });
  });
});

describe("reminderAllDay (cały dzień)", () => {
  it("flaga zapisuje się tylko gdy prawdziwa, a `false` znika jak brak pola", () => {
    expect(specOf({ reminder: 1, reminderAllDay: true })).toEqual({ reminder: 1, reminderAllDay: true });
    expect(specOf({ reminder: 1, reminderAllDay: false })).toEqual({ reminder: 1 });
  });

  it("readSpec przepuszcza tylko `true`, zły typ traktuje jak brak", () => {
    expect(readSpec({ reminder: 1, reminderAllDay: true })?.reminderAllDay).toBe(true);
    expect(readSpec({ reminder: 1, reminderAllDay: "tak" })).toEqual({ reminder: 1 });
  });

  it("mergeSpec wyłącza flagę jawnym undefined, a zwykła zmiana terminu ją zostawia", () => {
    const on = { reminder: 1, reminderAllDay: true };
    expect(mergeSpec(on, { reminderAllDay: undefined })).toEqual({ reminder: 1 });
    expect(mergeSpec(on, { reminder: 2 })).toEqual({ reminder: 2, reminderAllDay: true });
  });
});
