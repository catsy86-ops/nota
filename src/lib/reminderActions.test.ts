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
