import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { doneReminderUpdate, reminderFields, snoozeReminderUpdate } from "./reminderActions";
import { snoozeTimes } from "./reminderAgenda";

const base = (over: Partial<Note>): Note => ({
  id: "n1", title: "Zadanie", content: "", reminder: null, reminderRepeat: "none", ...over,
} as Note);

const NOW = new Date(2026, 9, 22, 10, 0).getTime();

describe("doneReminderUpdate", () => {
  it("zwykły termin: zdejmuje przypomnienie", () => {
    const note = base({ reminder: NOW - 60_000 });
    expect(doneReminderUpdate(note, NOW)).toEqual({ patch: { reminder: null }, message: "Przypomnienie odhaczone" });
  });

  it("seria: przechodzi do następnego wystąpienia, który jeszcze nie minął", () => {
    const at = new Date(2026, 9, 22, 9, 0).getTime();
    const note = base({ reminder: at, reminderRepeat: "daily" });
    const res = doneReminderUpdate(note, NOW);
    expect(res.message).toBe("Wystąpienie odhaczone — następne w serii");
    expect(res.patch.reminder).toBeGreaterThan(NOW);
    expect(res.patch.reminderBase).toBeUndefined();
  });
});

describe("snoozeReminderUpdate", () => {
  it("„Za godzinę” ustawia termin na godzinę od teraz (seria jednorazowa)", () => {
    const note = base({ reminder: NOW - 60_000 });
    const res = snoozeReminderUpdate(note, "inHour", NOW);
    expect(res.patch.reminder).toBe(snoozeTimes(NOW).inHour);
    expect(res.patch.reminderBase).toBeUndefined();
    expect(res.message).toBe("Przesunięto o godzinę");
  });

  it("„Jutro” ustawia 9:00 następnego dnia i zachowuje reminderDay", () => {
    const note = base({ reminder: NOW - 60_000, reminderDay: 1234 });
    const res = snoozeReminderUpdate(note, "tomorrow9", NOW);
    expect(res.patch.reminder).toBe(snoozeTimes(NOW).tomorrow9);
    expect(res.patch.reminderDay).toBe(1234);
    expect(res.message).toBe("Przesunięto na jutro, 9:00");
  });
});

describe("reminderFields", () => {
  it("zwraca pola do cofnięcia", () => {
    const note = base({ reminder: 5, reminderDay: 7, reminderBase: 9 });
    expect(reminderFields(note)).toEqual({ reminder: 5, reminderDay: 7, reminderBase: 9 });
  });
});

describe("menu „Odłóż” (2.1)", () => {
  const note = (reminder: number) => ({ reminder, reminderRepeat: "none", reminderDay: undefined, reminderBase: undefined } as never);
  const at = (h: number, min = 0) => new Date(2026, 9, 19, h, min).getTime();

  it("„Za 10 minut” odkłada o 10 minut od teraz", async () => {
    const { snoozeReminderUpdate } = await import("./reminderActions");
    const now = at(12);
    const { patch, message } = snoozeReminderUpdate(note(now), "in10", now);
    expect(patch.reminder).toBe(now + 10 * 60_000);
    expect(message).toBe("Przesunięto o 10 minut");
  });

  it("„Wieczorem” to 18:00, a po 17:30 pozycji nie ma w menu", async () => {
    const { snoozeReminderUpdate, snoozeMenuAt } = await import("./reminderActions");
    const now = at(12);
    expect(snoozeReminderUpdate(note(now), "evening", now).patch.reminder).toBe(at(18));
    expect(snoozeMenuAt(now).map((o) => o.kind)).toEqual(["in10", "evening"]);
    expect(snoozeMenuAt(at(17, 30)).map((o) => o.kind)).toEqual(["in10"]);
  });
});

describe("„Zakończ serię” (2.4)", () => {
  it("koniec serii ustawia się na bieżącym wystąpieniu; przy zwykłym terminie nic", async () => {
    const { endSeriesUpdate } = await import("./reminderActions");
    const at9 = new Date(2026, 9, 19, 9, 0).getTime();
    const series = { reminder: at9, reminderRepeat: "daily" } as never;
    const upd = endSeriesUpdate(series);
    expect(upd?.patch.reminderRepeatUntil).toBe(new Date(2026, 9, 19, 23, 59, 59, 999).getTime());
    expect(endSeriesUpdate({ reminder: at9, reminderRepeat: "none" } as never)).toBeNull();
    expect(endSeriesUpdate({ reminder: null, reminderRepeat: "daily" } as never)).toBeNull();
  });
});

describe("„Odłóż do…” (2.2)", () => {
  it("zwykły termin przechodzi na wybraną chwilę; seria odkłada jedno wystąpienie", async () => {
    const { snoozeToUpdate } = await import("./reminderActions");
    const now = new Date(2026, 9, 19, 12).getTime();
    const pick = new Date(2026, 9, 23, 8, 0).getTime();
    const plain = snoozeToUpdate({ reminder: now, reminderRepeat: "none" } as never, pick, now);
    expect(plain.patch.reminder).toBe(pick);
    expect(plain.message).toMatch(/^Odłożono do /);
    const beforeNext = new Date(2026, 9, 19, 15).getTime();
    const series = snoozeToUpdate({ reminder: now, reminderRepeat: "daily", reminderDay: 19 } as never, beforeNext, now);
    expect(series.patch.reminder).toBe(beforeNext);
    expect(series.patch.reminderBase).toBeDefined();
  });
});
